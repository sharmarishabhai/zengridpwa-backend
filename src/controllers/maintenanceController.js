const { Readable } = require("stream");
const cloudinary = require("../config/cloudinary");
const Plant = require("../models/Plant");
const Lead = require("../models/Lead");
const User = require("../models/User");
const MaintenanceTask = require("../models/MaintenanceTask");
const MaintenancePhoto = require("../models/MaintenancePhoto");
const { ROLES } = require("../utils/constants");
const { logAudit } = require("../utils/audit");
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);
const populate = (q) => q.populate("leadId", "customerName phone address area locality").populate("plantId", "installedAt locationLabel").populate("assignedPartnerId", "firstName lastName email");
async function partner() { return User.findOne({ userType: ROLES.MAINTENANCE_CLEANING_PARTNER, status: "active" }); }
async function listPlants(req, res) {
  const page = Math.max(1, Number(req.query.page || 1)), limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
  // In this application a Plant document is the installation/location record;
  // installedAt is optional in the existing workflow and cannot be the gate.
  const plants = await Plant.find({ leadId: { $ne: null } }).populate("leadId", "customerName phone address area locality").sort({ installedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const ids = plants.map((p) => p._id); const tasks = await MaintenanceTask.find({ plantId: { $in: ids } }).populate("assignedPartnerId", "firstName lastName email phoneNumber").sort({ scheduledDate: -1 }).lean();
  const result = plants.map((p) => { const ts = tasks.filter((t) => String(t.plantId) === String(p._id)); const latest = ts[0]; return { ...p, latestTask: latest || null, nextCleaningDate: latest?.status !== "Completed" ? latest?.scheduledDate : null }; });
  return res.json({ success: true, plants: result, page, limit });
}
async function listTasks(req, res) {
  const filter = req.user.userType === ROLES.MAINTENANCE_CLEANING_PARTNER ? { assignedPartnerId: req.user._id } : {};
  if (req.query.from || req.query.to) filter.scheduledDate = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to + "T23:59:59.999Z") } : {}) };
  const tasks = await populate(MaintenanceTask.find(filter).sort({ scheduledDate: 1 }));
  const now = new Date();
  return res.json({ success: true, tasks: tasks.map((t) => { const x = t.toObject(); if (x.status === "Scheduled" && new Date(x.scheduledDate) < now) x.status = "Overdue"; return x; }) });
}
async function assignTask(req, res) {
  const plant = await Plant.findById(req.params.plantId).populate("leadId"); if (!plant || !plant.leadId) return res.status(404).json({ success: false, message: "Installed plant not found" });
  const p = await partner(); if (!p) return res.status(409).json({ success: false, message: "Create the maintenance partner first" });
  const scheduledDate = new Date(req.body.scheduledDate); if (Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ success: false, message: "Valid scheduledDate is required" });
  const task = await MaintenanceTask.findOneAndUpdate({ plantId: plant._id, scheduledDate }, { $setOnInsert: { plantId: plant._id, leadId: plant.leadId._id, scheduledDate, assignedPartnerId: p._id, status: "Scheduled" } }, { upsert: true, new: true, setDefaultsOnInsert: true }); await Plant.updateOne({ _id: plant._id }, { nextCleaningDate: scheduledDate });
  await logAudit({ action: "maintenance_assignment", entityType: "MaintenanceTask", entityId: task._id, actorUserId: req.user._id, actorRole: req.user.userType, after: task.toObject() }); return res.status(201).json({ success: true, task: await populate(MaintenanceTask.findById(task._id)) });
}
async function uploadPhotos(req, res) {
  const task = await MaintenanceTask.findById(req.params.id); if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  if (String(task.assignedPartnerId) !== String(req.user._id) || task.status === "Completed" || task.status === "Cancelled") return res.status(403).json({ success: false, message: "Task is locked or not assigned to you" });
  const type = req.body.type; if (!["before", "after"].includes(type) || !req.files?.length) return res.status(400).json({ success: false, message: "type and photographs are required" });
  const photos = []; for (const file of req.files) { if (!/^image\//.test(file.mimetype)) return res.status(400).json({ success: false, message: "Only image files are allowed" }); const r = await new Promise((resolve, reject) => { const s = cloudinary.uploader.upload_stream({ folder: `maintenance-cleaning/${task.leadId}/${task._id}/${type}`, resource_type: "image" }, (e, v) => e ? reject(e) : resolve(v)); Readable.from(file.buffer).pipe(s); }); photos.push(await MaintenancePhoto.create({ taskId: task._id, leadId: task.leadId, type, publicId: r.public_id, secureUrl: r.secure_url })); }
  task.status = "In Progress"; await task.save(); return res.status(201).json({ success: true, photos });
}
async function completeTask(req, res) {
  const task = await MaintenanceTask.findById(req.params.id); if (!task || String(task.assignedPartnerId) !== String(req.user._id)) return res.status(404).json({ success: false, message: "Task not found" });
  if (task.status === "Completed") return res.json({ success: true, task });
  const counts = await MaintenancePhoto.aggregate([{ $match: { taskId: task._id } }, { $group: { _id: "$type", n: { $sum: 1 } } }]); if (!counts.some((x) => x._id === "before" && x.n) || !counts.some((x) => x._id === "after" && x.n)) return res.status(400).json({ success: false, message: "Before and after photographs are mandatory" });
  task.status = "Completed"; task.completedAt = new Date(); task.recurringGenerated = true; await task.save();
  const plant = await Plant.findById(task.plantId); if (plant && !plant.maintenancePaused) { const next = addDays(task.completedAt, 45); await MaintenanceTask.updateOne({ plantId: task.plantId, scheduledDate: next }, { $setOnInsert: { plantId: task.plantId, leadId: task.leadId, scheduledDate: next, assignedPartnerId: task.assignedPartnerId, status: "Scheduled" } }, { upsert: true }); await Plant.updateOne({ _id: plant._id }, { nextCleaningDate: next }); }
  await logAudit({ action: "maintenance_completion", entityType: "MaintenanceTask", entityId: task._id, actorUserId: req.user._id, actorRole: req.user.userType, after: task.toObject() }); return res.json({ success: true, task });
}
async function history(req, res) { const filter = req.user.userType === ROLES.MAINTENANCE_CLEANING_PARTNER ? { plantId: req.params.plantId, assignedPartnerId: req.user._id } : { plantId: req.params.plantId }; const tasks = await populate(MaintenanceTask.find(filter).sort({ scheduledDate: -1 })); const photos = await MaintenancePhoto.find({ taskId: { $in: tasks.map((t) => t._id) } }).lean(); return res.json({ success: true, tasks: tasks.map((t) => ({ ...t.toObject(), photos: photos.filter((p) => String(p.taskId) === String(t._id)) })) }); }
async function partnerHistory(req, res) { const tasks = await populate(MaintenanceTask.find({ assignedPartnerId: req.user._id, status: "Completed" }).sort({ completedAt: -1 })); const photos = await MaintenancePhoto.find({ taskId: { $in: tasks.map((t) => t._id) } }).lean(); return res.json({ success: true, tasks: tasks.map((t) => ({ ...t.toObject(), photos: photos.filter((p) => String(p.taskId) === String(t._id)) })) }); }
async function pause(req, res) { const plant = await Plant.findById(req.params.plantId); if (!plant) return res.status(404).json({ success: false, message: "Plant not found" }); plant.maintenancePaused = Boolean(req.body.paused); await plant.save(); return res.json({ success: true, paused: plant.maintenancePaused }); }
async function reschedule(req, res) { const task = await MaintenanceTask.findById(req.params.id); if (!task || ["Completed", "Cancelled"].includes(task.status)) return res.status(400).json({ success: false, message: "Only pending tasks can be rescheduled" }); const date = new Date(req.body.scheduledDate); if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, message: "Valid scheduledDate is required" }); task.scheduledDate = date; task.status = "Scheduled"; await task.save(); await logAudit({ action: "maintenance_reschedule", entityType: "MaintenanceTask", entityId: task._id, actorUserId: req.user._id, actorRole: req.user.userType, after: task.toObject() }); return res.json({ success: true, task }); }
async function cancel(req, res) { const task = await MaintenanceTask.findById(req.params.id); if (!task || ["Completed", "Cancelled"].includes(task.status)) return res.status(400).json({ success: false, message: "Only pending tasks can be cancelled" }); task.status = "Cancelled"; await task.save(); await logAudit({ action: "maintenance_cancel", entityType: "MaintenanceTask", entityId: task._id, actorUserId: req.user._id, actorRole: req.user.userType, after: task.toObject() }); return res.json({ success: true, task }); }
module.exports = { listPlants, listTasks, assignTask, uploadPhotos, completeTask, history, partnerHistory, pause, reschedule, cancel };
