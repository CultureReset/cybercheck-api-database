#!/usr/bin/env python3
"""
Run this to add fleet/docks/addons/included cases to scroll-profile-v2.html
Usage: python3 patch-template.py
"""

src = '/Users/owner/build-main/templates/scroll-profile-v2.html'
content = open(src).read()

marker = "      // \u2500\u2500 Generic: any sec.id that matches foodMenu cat.meal renders those categories \u2500\u2500"

if marker not in content:
    print("ERROR: marker not found. File may have already been patched.")
    exit(1)

new_cases = """      case 'fleet':
        html += '</div>';
        el.innerHTML = '<h2 style="padding:0 4px 8px;font-size:22px">'+(sec.icon||'')+' '+sec.label+'</h2>';
        if (B.fleet) B.fleet.forEach(function(boat){
          var b='<div class="card" style="margin-bottom:16px">';
          if(boat.image) b+='<img src="'+boat.image+'" style="width:100%;border-radius:10px;margin-bottom:12px;object-fit:cover;max-height:200px" loading="lazy">';
          if(boat.badge) b+='<div style="display:inline-block;background:#0af;color:#000;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-bottom:6px">'+boat.badge+'</div>';
          b+='<div style="font-size:18px;font-weight:700;margin-bottom:4px">'+boat.name+'</div>';
          b+='<div style="font-size:13px;color:#bbb;margin-bottom:10px">'+(boat.description||'')+'</div>';
          b+='<div style="display:flex;gap:12px;flex-wrap:wrap">';
          if(boat.halfDay) b+='<div style="background:#1a1a2e;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:11px;color:#888">Half Day</div><div style="font-size:20px;font-weight:700">$'+boat.halfDay+'</div></div>';
          if(boat.allDay) b+='<div style="background:#1a1a2e;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:11px;color:#888">All Day</div><div style="font-size:20px;font-weight:700">$'+boat.allDay+'</div></div>';
          if(boat.qty) b+='<div style="background:#1a1a2e;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:11px;color:#888">Available</div><div style="font-size:20px;font-weight:700">'+boat.qty+'</div></div>';
          b+='</div></div>'; el.innerHTML+=b;
        });
        container.appendChild(el); return;

      case 'docks':
        html += '</div>';
        el.innerHTML = '<h2 style="padding:0 4px 8px;font-size:22px">'+(sec.icon||'')+' '+sec.label+'</h2>';
        if (B.docks) B.docks.forEach(function(d){
          var b='<div class="card" style="margin-bottom:12px">';
          b+='<div style="font-size:16px;font-weight:700;margin-bottom:4px">'+d.name+'</div>';
          if(d.specs) b+='<div style="font-size:12px;color:#888;margin-bottom:4px">'+d.specs+'</div>';
          if(d.desc) b+='<div style="font-size:13px;color:#bbb;margin-bottom:10px">'+d.desc+'</div>';
          b+='<div style="display:flex;gap:12px;flex-wrap:wrap">';
          if(d.halfDay) b+='<div style="background:#1a1a2e;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:11px;color:#888">Half Day</div><div style="font-size:18px;font-weight:700">$'+d.halfDay+'</div></div>';
          if(d.allDay) b+='<div style="background:#1a1a2e;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:11px;color:#888">All Day</div><div style="font-size:18px;font-weight:700">$'+d.allDay+'</div></div>';
          b+='</div></div>'; el.innerHTML+=b;
        });
        container.appendChild(el); return;

      case 'addons':
        html += '</div>';
        el.innerHTML = '<h2 style="padding:0 4px 8px;font-size:22px">'+(sec.icon||'')+' '+sec.label+'</h2>';
        if (B.addons) {
          var g='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">';
          B.addons.forEach(function(a){
            g+='<div class="card" style="text-align:center;padding:12px">';
            if(a.image) g+='<img src="'+a.image+'" style="width:100%;border-radius:8px;margin-bottom:8px;object-fit:cover;height:100px" loading="lazy">';
            g+='<div style="font-size:20px;margin-bottom:4px">'+(a.icon||'')+'</div>';
            g+='<div style="font-size:14px;font-weight:700;margin-bottom:2px">'+a.name+'</div>';
            g+='<div style="font-size:18px;font-weight:700;color:#0af">$'+a.price+'</div>';
            g+='<div style="font-size:11px;color:#888">'+(a.perUnit||'')+'</div>';
            if(a.desc) g+='<div style="font-size:12px;color:#bbb;margin-top:6px">'+a.desc+'</div>';
            g+='</div>';
          });
          g+='</div>'; el.innerHTML+=g;
        }
        container.appendChild(el); return;

      case 'included':
        if (B.about && B.about.included) {
          html+='<div class="perks">'+B.about.included.map(function(i){return '<span class="perk">&#10003; '+i+'</span>';}).join('')+'</div>';
        }
        break;

      // \u2500\u2500 Generic: any sec.id that matches foodMenu cat.meal renders those categories \u2500\u2500"""

patched = content.replace(marker, new_cases, 1)
open(src, 'w').write(patched)
print("Done! Patched", src)
print("New line count:", patched.count('\\n'))
