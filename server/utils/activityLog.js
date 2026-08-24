import ActivityLog from '../models/ActivityLog.js';

// Fire-and-forget activity logging — never blocks or fails the request
const logActivity = (req, { action, module, description }) =>
  ActivityLog.create({
    userId: req.user?._id,
    userName: req.user?.name,
    action,
    module,
    description,
  }).catch(() => {});

export default logActivity;
