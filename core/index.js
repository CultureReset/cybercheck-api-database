/**
 * core — the kernel every module is allowed to depend on.
 *
 * A module requires from here and nowhere else in the tree. If a module needs
 * something that isn't in this list, it either belongs in core or the module is
 * reaching into another module (which it must not do).
 */
module.exports = {
    db:             require('./db'),
    getGcrDb:       require('./gcr-db'),
    auth:           require('./auth'),
    domain:         require('./domain'),
    sms:            require('./sms'),
    email:          require('./email'),
    ai:             require('./ai'),
    crypto:         require('./crypto'),
    registry:       require('./registry'),
    entityResolver: require('./entity-resolver'),
    menuGcr:        require('./menu-gcr'),
};
