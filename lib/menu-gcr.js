// Translate between the admin dashboard's flat menu-item shape and
// the GCR DB's normalized menu/drink/happy_hour tables.
//
// Admin shape:
//   { id, name, price, category, item_type, description, tags, modifiers, photo_url, sort_order }
// item_type: 'food' | 'drink' | 'happy_hour'
//
// GCR tables (scoped by entity_id):
//   food       → menu_sections / menu_sub_sections / menu_items
//   drink      → drink_sections / drink_items
//   happy_hour → happy_hour_sections / happy_hour_items
//
// tags / modifiers are stored as JSONB columns added via migration.

const getGcrDb = require('../gcr-db');

function tableMap(itemType) {
    switch (itemType) {
        case 'drink':
            return { sectionTable: 'drink_sections', itemTable: 'drink_items', fk: 'drink_section_id' };
        case 'happy_hour':
            return { sectionTable: 'happy_hour_sections', itemTable: 'happy_hour_items', fk: 'hh_section_id' };
        case 'food':
        default:
            return { sectionTable: 'menu_sections', itemTable: 'menu_items', fk: 'menu_section_id' };
    }
}

async function findOrCreateSection(entityId, itemType, categoryName) {
    const db = getGcrDb();
    const { sectionTable } = tableMap(itemType);
    const name = (categoryName || 'Menu Items').trim();

    const { data: existing } = await db
        .from(sectionTable)
        .select('id')
        .eq('entity_id', entityId)
        .eq('section_name', name)
        .limit(1)
        .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await db
        .from(sectionTable)
        .insert({ entity_id: entityId, section_name: name, sort_order: 0 })
        .select('id')
        .single();
    if (error) throw error;
    return created.id;
}

function rowToAdmin(row, itemType, sectionNameById) {
    return {
        id: row.id,
        name: row.item_name,
        price: parseFloat(row.price ?? row.hh_price ?? 0) || 0,
        category: sectionNameById[row.menu_section_id || row.drink_section_id || row.hh_section_id] || 'Uncategorized',
        item_type: itemType,
        description: row.description || '',
        tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
        modifiers: Array.isArray(row.modifiers) ? row.modifiers : [],
        photo_url: row.image_url || '',
        sort_order: row.sort_order || 0,
    };
}

async function listAllMenuItems(entityId) {
    const db = getGcrDb();
    const types = ['food', 'drink', 'happy_hour'];
    const out = [];

    for (const t of types) {
        const { sectionTable, itemTable } = tableMap(t);
        const [sectionsRes, itemsRes] = await Promise.all([
            db.from(sectionTable).select('id, section_name').eq('entity_id', entityId),
            db.from(itemTable).select('*').eq('entity_id', entityId).order('sort_order', { ascending: true }),
        ]);
        const sectionNameById = {};
        (sectionsRes.data || []).forEach(s => { sectionNameById[s.id] = s.section_name; });
        (itemsRes.data || []).forEach(row => out.push(rowToAdmin(row, t, sectionNameById)));
    }
    return out;
}

function buildItemPayload(entityId, body, sectionId, itemType) {
    const base = {
        entity_id: entityId,
        item_name: body.name,
        description: body.description || '',
        image_url: body.photo_url || null,
        sort_order: body.sort_order || 0,
        tags: Array.isArray(body.tags) ? body.tags : [],
        modifiers: Array.isArray(body.modifiers) ? body.modifiers : [],
    };
    if (itemType === 'happy_hour') {
        base.hh_section_id = sectionId;
        base.hh_price = parseFloat(body.price) || 0;
    } else {
        const fk = itemType === 'drink' ? 'drink_section_id' : 'menu_section_id';
        base[fk] = sectionId;
        base.price = parseFloat(body.price) || 0;
    }
    return base;
}

async function createMenuItem(entityId, body) {
    const db = getGcrDb();
    const itemType = body.item_type || 'food';
    const sectionId = await findOrCreateSection(entityId, itemType, body.category);
    const { itemTable } = tableMap(itemType);
    const fk = itemType === 'happy_hour' ? 'hh_section_id' : (itemType === 'drink' ? 'drink_section_id' : 'menu_section_id');
    const payload = buildItemPayload(entityId, body, sectionId, itemType);

    // Dedup: if an item with the same name already exists in this section,
    // update it instead of creating a duplicate. Covers image scans, AI chat,
    // and Daily Update Link submissions all landing here.
    const name = (body.name || '').trim();
    const { data: existing } = await db
        .from(itemTable)
        .select('id')
        .eq('entity_id', entityId)
        .eq(fk, sectionId)
        .ilike('item_name', name)
        .limit(1)
        .maybeSingle();

    let data, error;
    if (existing && existing.id) {
        ({ data, error } = await db.from(itemTable).update(payload).eq('id', existing.id).select().single());
    } else {
        ({ data, error } = await db.from(itemTable).insert(payload).select().single());
    }
    if (error) throw error;

    const sectionNameById = { [sectionId]: (body.category || 'Menu Items').trim() };
    return rowToAdmin(data, itemType, sectionNameById);
}

async function findItemTable(entityId, itemId) {
    const db = getGcrDb();
    for (const t of ['food', 'drink', 'happy_hour']) {
        const { itemTable } = tableMap(t);
        const { data } = await db.from(itemTable).select('id').eq('entity_id', entityId).eq('id', itemId).maybeSingle();
        if (data) return { itemType: t, itemTable };
    }
    return null;
}

async function updateMenuItem(entityId, itemId, body) {
    const db = getGcrDb();
    const match = await findItemTable(entityId, itemId);
    if (!match) throw new Error('Item not found');
    const { itemType, itemTable } = match;

    const updates = {};
    if (body.name !== undefined) updates.item_name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.photo_url !== undefined) updates.image_url = body.photo_url;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : [];
    if (body.modifiers !== undefined) updates.modifiers = Array.isArray(body.modifiers) ? body.modifiers : [];
    if (body.price !== undefined) {
        if (itemType === 'happy_hour') updates.hh_price = parseFloat(body.price) || 0;
        else updates.price = parseFloat(body.price) || 0;
    }
    if (body.category !== undefined) {
        const sectionId = await findOrCreateSection(entityId, itemType, body.category);
        const fk = itemType === 'happy_hour' ? 'hh_section_id' : (itemType === 'drink' ? 'drink_section_id' : 'menu_section_id');
        updates[fk] = sectionId;
    }

    const { data, error } = await db.from(itemTable).update(updates).eq('id', itemId).eq('entity_id', entityId).select().single();
    if (error) throw error;

    const fk = data.menu_section_id || data.drink_section_id || data.hh_section_id;
    const { sectionTable } = tableMap(itemType);
    const { data: sectionRow } = await db.from(sectionTable).select('section_name').eq('id', fk).maybeSingle();
    return rowToAdmin(data, itemType, { [fk]: sectionRow ? sectionRow.section_name : 'Uncategorized' });
}

async function deleteMenuItem(entityId, itemId) {
    const db = getGcrDb();
    const match = await findItemTable(entityId, itemId);
    if (!match) return false;
    const { error } = await db.from(match.itemTable).delete().eq('id', itemId).eq('entity_id', entityId);
    if (error) throw error;
    return true;
}

module.exports = {
    listAllMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    findOrCreateSection,
};
