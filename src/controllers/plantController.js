const Plant = require("../models/Plant");
const Lead = require("../models/Lead");
const { ROLES } = require("../utils/constants");

function canSeeLead(user, lead) {
  return user.userType === ROLES.ADMIN || (user.userType === ROLES.SC && String(lead.assignedToUserId || "") === String(user._id));
}

async function listPlants(req, res) {
  const plants = await Plant.find().populate({ path: "leadId", select: "customerName phone address area locality assignedToUserId" }).sort({ createdAt: -1 });
  // Installed plants are shared operational locations: every SC can view the full map.
  const visible = plants.filter((p) => p.leadId);
  return res.json({ success: true, plants: visible });
}

async function upsertPlant(req, res) {
  const lead = await Lead.findById(req.body.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Customer not found" });
  if (!canSeeLead(req.user, lead)) return res.status(403).json({ success: false, message: "You can only manage assigned customers" });
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ success: false, message: "Valid latitude and longitude are required" });
  }
  const plant = await Plant.findOneAndUpdate({ leadId: lead._id }, { leadId: lead._id, latitude, longitude, locationLabel: req.body.locationLabel || "", installedAt: req.body.installedAt || null, createdBy: req.user._id }, { new: true, upsert: true, setDefaultsOnInsert: true }).populate({ path: "leadId", select: "customerName phone address area locality assignedToUserId" });
  return res.json({ success: true, plant });
}

async function deletePlant(req, res) {
  const plant = await Plant.findById(req.params.id).populate("leadId");
  if (!plant) return res.status(404).json({ success: false, message: "Plant not found" });
  if (!canSeeLead(req.user, plant.leadId)) return res.status(403).json({ success: false, message: "Forbidden" });
  await plant.deleteOne();
  return res.json({ success: true });
}

module.exports = { listPlants, upsertPlant, deletePlant };
