const SystemSize = require("../models/SystemSize");
const SolarPanel = require("../models/SolarPanel");
const Inverter = require("../models/Inverter");
const StructureType = require("../models/StructureType");
const WiringOption = require("../models/WiringOption");
const TaxSubsidy = require("../models/TaxSubsidy");

const resources = {
  "system-sizes": {
    model: SystemSize,
    type: "system-size",
    defaults: [
      { name: "3 kW", sizeKw: 3, systemPrice: 205000 },
      { name: "5 kW", sizeKw: 5, systemPrice: 315000 },
      { name: "10 kW", sizeKw: 10, systemPrice: 575000 },
    ],
    shape(body) {
      return { name: body.name, sizeKw: Number(body.sizeKw || 0), systemPrice: Number(body.systemPrice || 0), status: body.status || "active" };
    },
  },
  "solar-panels": {
    model: SolarPanel,
    type: "solar-panel",
    defaults: [
      { name: "Premier Topcon DCR 600W", watt: 600 },
      { name: "Adani 540W Mono PERC", watt: 540 },
      { name: "Waaree 540W", watt: 540 },
      { name: "Vikram Solar 540W", watt: 540 },
    ],
    shape(body) {
      return { name: body.name, watt: Number(body.watt || 0), status: body.status || "active" };
    },
  },
  inverters: {
    model: Inverter,
    type: "inverter",
    defaults: [{ name: "Growatt" }, { name: "Sungrow" }, { name: "GoodWe" }],
    shape(body) {
      return { name: body.name, status: body.status || "active" };
    },
  },
  structures: {
    model: StructureType,
    type: "structure-type",
    defaults: [{ name: "Hot Dip Galvanized" }, { name: "Elevated Structure" }],
    shape(body) {
      return { name: body.name, status: body.status || "active" };
    },
  },
  wiring: {
    model: WiringOption,
    type: "wiring",
    defaults: [{ name: "Standard DC/AC Wiring" }, { name: "Premium Copper Wiring" }],
    shape(body) {
      return { name: body.name, status: body.status || "active" };
    },
  },
  "tax-subsidies": {
    model: TaxSubsidy,
    type: "tax-subsidy",
    defaults: [{ gstPercent: 8.9, centralSubsidy: 78000, upnedaSubsidy: 30000 }],
    shape(body) {
      return {
        gstPercent: Number(body.gstPercent || 0),
        centralSubsidy: Number(body.centralSubsidy || 0),
        upnedaSubsidy: Number(body.upnedaSubsidy || 0),
        status: body.status || "active",
      };
    },
  },
};

async function seedResource(key, userId) {
  const cfg = resources[key];
  const count = await cfg.model.estimatedDocumentCount();
  if (count) return;
  await cfg.model.insertMany(
    cfg.defaults.map((row) => ({ ...row, status: "active", createdByUserId: userId, updatedByUserId: userId })),
    { ordered: false }
  ).catch(() => {});
}

async function ensureDefaults(userId) {
  await Promise.all(Object.keys(resources).map((key) => seedResource(key, userId)));
}

function tag(type, rows) {
  return rows.map((row) => ({ ...row.toObject(), type }));
}

async function listConfigItems(req, res) {
  await ensureDefaults(req.user._id);
  const activeFilter = req.query.active === "true" ? { status: "active" } : {};
  const [systemSizes, solarPanels, inverters, structures, wiring, taxSubsidies] = await Promise.all([
    SystemSize.find(activeFilter).sort({ sizeKw: 1 }),
    SolarPanel.find(activeFilter).sort({ watt: -1, name: 1 }),
    Inverter.find(activeFilter).sort({ name: 1 }),
    StructureType.find(activeFilter).sort({ name: 1 }),
    WiringOption.find(activeFilter).sort({ name: 1 }),
    TaxSubsidy.find(activeFilter).sort({ createdAt: -1 }),
  ]);
  const items = [
    ...tag("system-size", systemSizes),
    ...tag("solar-panel", solarPanels),
    ...tag("inverter", inverters),
    ...tag("structure-type", structures),
    ...tag("wiring", wiring),
    ...tag("tax-subsidy", taxSubsidies),
  ];
  return res.json({ success: true, systemSizes, solarPanels, inverters, structures, wiring, taxSubsidies, items });
}

async function listResource(req, res) {
  const cfg = resources[req.params.resource];
  if (!cfg) return res.status(404).json({ success: false, message: "Configuration page not found" });
  await seedResource(req.params.resource, req.user._id);
  const items = await cfg.model.find(req.query.active === "true" ? { status: "active" } : {}).sort({ createdAt: -1 });
  return res.json({ success: true, items });
}

async function createResource(req, res) {
  const cfg = resources[req.params.resource];
  if (!cfg) return res.status(404).json({ success: false, message: "Configuration page not found" });
  const payload = cfg.shape(req.body);
  if (req.params.resource !== "tax-subsidies" && !payload.name) return res.status(400).json({ success: false, message: "name is required" });
  const item = await cfg.model.create({ ...payload, createdByUserId: req.user._id, updatedByUserId: req.user._id });
  return res.status(201).json({ success: true, item });
}

async function updateResource(req, res) {
  const cfg = resources[req.params.resource];
  if (!cfg) return res.status(404).json({ success: false, message: "Configuration page not found" });
  const item = await cfg.model.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Configuration item not found" });
  Object.assign(item, cfg.shape({ ...item.toObject(), ...req.body }), { updatedByUserId: req.user._id });
  await item.save();
  return res.json({ success: true, item });
}

async function deleteResource(req, res) {
  const cfg = resources[req.params.resource];
  if (!cfg) return res.status(404).json({ success: false, message: "Configuration page not found" });
  const item = await cfg.model.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Configuration item not found" });
  await cfg.model.deleteOne({ _id: item._id });
  return res.json({ success: true, message: "Configuration item deleted" });
}

module.exports = { listConfigItems, listResource, createResource, updateResource, deleteResource };
