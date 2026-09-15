require("dotenv").config();

const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");

const User = require("../src/models/User");
const Lead = require("../src/models/Lead");
const Payment = require("../src/models/Payment");
const Quote = require("../src/models/Quote");
const GstInvoice = require("../src/models/GstInvoice");
const { ROLES, STATUSES } = require("../src/utils/constants");
const { LEAD_STATUSES, MEETING_STATUSES, SOURCES } = require("../src/utils/leadConstants");

const DEFAULT_FILE = "C:/Users/DELL/Downloads/zengrid Solar Leads.xlsx";
const DEFAULT_EMAIL_DOMAIN = "zengrid.local";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

const options = {
  file: path.resolve(getArg("file", DEFAULT_FILE)),
  commit: process.argv.includes("--commit"),
  overwrite: process.argv.includes("--overwrite"),
};

function clean(value) {
  return String(value ?? "").trim();
}

function key(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function nameKey(value) {
  const aliases = {
    heba: "hiba",
    shailja: "shalija",
    "shailja mishra": "shalija",
    srishti: "sristi",
  };
  const normalized = key(value);
  return aliases[normalized] || normalized;
}

function toNameParts(name) {
  const parts = clean(name).replace(/\s+/g, " ").split(" ").filter(Boolean);
  return {
    firstName: parts[0] || "User",
    lastName: parts.slice(1).join(" ") || "-",
  };
}

function slug(value) {
  return key(value).replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "user";
}

function syntheticEmail(name, uid) {
  return `${slug(name)}.${clean(uid) || Date.now()}@${DEFAULT_EMAIL_DOMAIN}`;
}

function syntheticPhone(uid, name) {
  return `import-${clean(uid) || slug(name)}`;
}

function importPassword(value, name) {
  const password = clean(value) || `${slug(name)}@123`;
  return password.length >= 6 ? password : `${password}@123`;
}

function roleFromSheet(role) {
  const normalized = key(role);
  if (normalized === "admin") return ROLES.ADMIN;
  if (normalized === "lrm") return ROLES.LRM;
  if (normalized === "sales" || normalized === "sc") return ROLES.SC;
  return "";
}

function numberValue(value, fallback = 0) {
  const normalized = clean(value).replace(/[₹,\s]/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateValue(value) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,|\s|$)/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function timeValue(value) {
  const raw = clean(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function leadStatus(value) {
  const normalized = key(value).replace("-", " ");
  const map = {
    "new lead": LEAD_STATUSES.NEW,
    contacted: LEAD_STATUSES.CONTACTED,
    interested: LEAD_STATUSES.INTERESTED,
    "follow up": LEAD_STATUSES.FOLLOW_UP,
    "not available": LEAD_STATUSES.NOT_AVAILABLE,
    "not picking call": LEAD_STATUSES.NOT_PICKING_CALL,
    rescheduled: LEAD_STATUSES.RESCHEDULED,
    "not interested": LEAD_STATUSES.NOT_INTERESTED,
    won: LEAD_STATUSES.WON,
    lost: LEAD_STATUSES.LOST,
  };
  return map[normalized] || LEAD_STATUSES.NEW;
}

function meetingStatus(value) {
  const normalized = key(value);
  if (normalized === MEETING_STATUSES.STARTED) return MEETING_STATUSES.STARTED;
  if (normalized === MEETING_STATUSES.DONE) return MEETING_STATUSES.DONE;
  return MEETING_STATUSES.ASSIGNED;
}

function sourceValue(value) {
  const normalized = key(value);
  if (normalized === "website") return SOURCES.WEBSITE;
  if (["facebook ad", "social media", "facebook"].includes(normalized)) return SOURCES.SOCIAL_MEDIA;
  if (["field visit", "other", "reference", "referral"].includes(normalized)) return SOURCES.FIELD_VISIT;
  return SOURCES.IMPORT;
}

function rows(workbook, sheetName) {
  if (!workbook.Sheets[sheetName]) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
    blankrows: false,
  });
}

function userFullName(user) {
  return `${user.firstName} ${user.lastName}`.replace(/\s+-$/, "").trim();
}

async function makeUniqueNo(Model, field, desired, prefix) {
  const base = clean(desired) || `${prefix}-${Date.now()}`;
  let candidate = base;
  for (let i = 1; await Model.exists({ [field]: candidate }); i += 1) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");

  const workbook = XLSX.readFile(options.file, { cellDates: true });
  const sheetRows = {
    users: rows(workbook, "Users"),
    leads: rows(workbook, "Solar Leads"),
    quotes: rows(workbook, "Quotations"),
    payments: rows(workbook, "Payments"),
    invoices: rows(workbook, "GST Invoices"),
  };

  const report = {
    mode: options.commit ? "commit" : "dry-run",
    file: options.file,
    sheets: Object.fromEntries(Object.entries(sheetRows).map(([name, data]) => [name, data.length])),
    users: { create: 0, update: 0, skip: 0 },
    leads: { create: 0, update: 0, duplicatePhoneRows: 0, invalidRows: 0 },
    quotes: { create: 0, update: 0, missingLead: 0 },
    payments: { create: 0, update: 0, missingLead: 0 },
    invoices: { create: 0, update: 0, missingLead: 0 },
    warnings: [],
  };

  await mongoose.connect(process.env.MONGODB_URI);

  const existingUsers = await User.find({});
  const usersByName = new Map(existingUsers.map((user) => [nameKey(userFullName(user)), user]));
  const usersByEmail = new Map(existingUsers.map((user) => [key(user.email), user]));

  const adminFromSheet = sheetRows.users.find((row) => roleFromSheet(row.Role) === ROLES.ADMIN);
  let fallbackAdmin = usersByName.get(nameKey(adminFromSheet?.Name)) || existingUsers.find((user) => user.userType === ROLES.ADMIN);

  for (const row of sheetRows.users) {
    const name = clean(row.Name);
    const role = roleFromSheet(row.Role);
    if (!name || !role) {
      report.users.skip += 1;
      report.warnings.push(`Skipped user row with missing/invalid name or role: ${JSON.stringify(row)}`);
      continue;
    }

    const found = usersByName.get(nameKey(name)) || usersByEmail.get(key(row.Email || syntheticEmail(name, row.UID)));
    const { firstName, lastName } = toNameParts(name);
    const payload = {
      firstName,
      lastName,
      phoneNumber: clean(row.Phone) || syntheticPhone(row.UID, name),
      email: clean(row.Email).toLowerCase() || syntheticEmail(name, row.UID),
      password: importPassword(row.Password, name),
      userType: role,
      status: STATUSES.ACTIVE,
      createdBy: fallbackAdmin?._id || null,
    };

    if (found) {
      report.users.update += options.overwrite ? 1 : 0;
      report.users.skip += options.overwrite ? 0 : 1;
      if (options.commit && options.overwrite) {
        Object.assign(found, payload);
        await found.save();
      }
      usersByName.set(nameKey(name), found);
      continue;
    }

    report.users.create += 1;
    if (options.commit) {
      const created = await User.create(payload);
      usersByName.set(nameKey(name), created);
      if (!fallbackAdmin && created.userType === ROLES.ADMIN) fallbackAdmin = created;
    } else {
      const virtualUser = { _id: new mongoose.Types.ObjectId(), ...payload };
      usersByName.set(nameKey(name), virtualUser);
      if (!fallbackAdmin && virtualUser.userType === ROLES.ADMIN) fallbackAdmin = virtualUser;
    }
  }

  if (!fallbackAdmin) {
    throw new Error("No admin user available. Add an admin row in Users or seed one before import.");
  }

  const dbLeads = await Lead.find({});
  const leadsByLegacyId = new Map(dbLeads.filter((lead) => lead.leadId).map((lead) => [key(lead.leadId), lead]));
  const leadsByPhone = new Map(dbLeads.map((lead) => [clean(lead.phone), lead]));
  const seenPhones = new Set();

  for (const row of sheetRows.leads) {
    const legacyId = clean(row.ID);
    const customerName = clean(row.Name);
    const phone = clean(row.Phone);
    if (!legacyId || !customerName || !phone) {
      report.leads.invalidRows += 1;
      report.warnings.push(`Skipped lead row with missing ID/name/phone: ${legacyId || "(no id)"}`);
      continue;
    }
    if (seenPhones.has(phone) && !leadsByLegacyId.has(key(legacyId))) {
      report.leads.duplicatePhoneRows += 1;
      report.warnings.push(`Skipped duplicate phone inside sheet: ${legacyId} ${customerName} ${phone}`);
      continue;
    }
    seenPhones.add(phone);

    const assignedToUser = usersByName.get(nameKey(row.AssignedTo));
    const assignedByUser = usersByName.get(nameKey(row.AssignedBy));
    if (clean(row.AssignedTo) && !assignedToUser) report.warnings.push(`Lead ${legacyId}: unknown AssignedTo "${clean(row.AssignedTo)}"`);
    if (clean(row.AssignedBy) && !assignedByUser) report.warnings.push(`Lead ${legacyId}: unknown AssignedBy "${clean(row.AssignedBy)}"`);

    const payload = {
      customerName,
      leadId: legacyId,
      phone,
      area: clean(row.Area),
      monthlyBill: numberValue(row.Bill),
      source: sourceValue(row.Source),
      leadStatus: leadStatus(row.Status),
      followUpDate: dateValue(row.FollowUpDate),
      assignedTo: assignedToUser?.userType === ROLES.SC ? userFullName(assignedToUser) : clean(row.AssignedTo),
      assignedBy: assignedByUser?.userType === ROLES.LRM ? userFullName(assignedByUser) : clean(row.AssignedBy),
      assignedToUserId: assignedToUser?.userType === ROLES.SC ? assignedToUser._id : null,
      assignedByUserId: assignedByUser?.userType === ROLES.LRM ? assignedByUser._id : null,
      meetingDate: dateValue(row.MeetingDate),
      meetingTime: timeValue(row.MeetingTime),
      meetingStatus: meetingStatus(row.MeetingStatus),
      note: clean(row.Notes),
      createdByRole: ROLES.ADMIN,
      createdByUserId: fallbackAdmin._id,
      updatedByUserId: fallbackAdmin._id,
    };

    const found = leadsByLegacyId.get(key(legacyId)) || leadsByPhone.get(phone);
    if (found) {
      report.leads.update += options.overwrite ? 1 : 0;
      if (options.commit && options.overwrite) {
        Object.assign(found, payload);
        await found.save();
      }
      leadsByLegacyId.set(key(legacyId), found);
      leadsByPhone.set(phone, found);
      continue;
    }

    report.leads.create += 1;
    if (options.commit) {
      const created = await Lead.create(payload);
      leadsByLegacyId.set(key(legacyId), created);
      leadsByPhone.set(phone, created);
    } else {
      const virtualLead = { _id: new mongoose.Types.ObjectId(), ...payload };
      leadsByLegacyId.set(key(legacyId), virtualLead);
      leadsByPhone.set(phone, virtualLead);
    }
  }

  async function legacyLead(row, sheet, field = "LeadID") {
    const id = clean(row[field]);
    const phone = clean(row.Phone);
    const lead = leadsByLegacyId.get(key(id)) || leadsByPhone.get(phone);
    if (!lead) report[sheet].missingLead += 1;
    return lead;
  }

  for (const row of sheetRows.quotes) {
    const lead = await legacyLead(row, "quotes");
    if (!lead) continue;
    const found = await Quote.findOne({ quoteNo: clean(row.QuoteID) });
    if (found) {
      report.quotes.update += options.overwrite ? 1 : 0;
      continue;
    }
    report.quotes.create += 1;
    if (options.commit) {
      const netPrice = numberValue(row.NetPrice);
      await Quote.create({
        quoteNo: await makeUniqueNo(Quote, "quoteNo", row.QuoteID, "Q"),
        leadId: lead._id,
        leadName: clean(row.LeadName) || lead.customerName,
        phone: clean(row.Phone) || lead.phone,
        whatsappNumber: lead.whatsappNumber,
        email: lead.email,
        address: lead.address,
        area: lead.area,
        monthlyBill: lead.monthlyBill,
        systemSize: clean(row.SystemSize),
        price: netPrice,
        netPrice,
        netEffectivePrice: netPrice,
        note: clean(row.QuoteHTML) ? "Imported legacy quotation HTML was present in source sheet." : "",
        generatedByUserId: usersByName.get(nameKey(row.GeneratedBy))?._id || fallbackAdmin._id,
        assignedToUserId: lead.assignedToUserId,
        assignedByUserId: lead.assignedByUserId,
      });
    }
  }

  for (const row of sheetRows.payments) {
    const lead = await legacyLead(row, "payments");
    if (!lead) continue;
    const found = await Payment.findOne({ paymentNo: clean(row.PaymentID) });
    if (found) {
      report.payments.update += options.overwrite ? 1 : 0;
      continue;
    }
    report.payments.create += 1;
    if (options.commit) {
      await Payment.create({
        paymentNo: await makeUniqueNo(Payment, "paymentNo", row.PaymentID, "P"),
        leadId: lead._id,
        leadName: clean(row.LeadName) || lead.customerName,
        phone: clean(row.Phone) || lead.phone,
        whatsappNumber: lead.whatsappNumber,
        email: lead.email,
        address: lead.address,
        totalAmount: numberValue(row.TotalAmount),
        paidAmount: numberValue(row.PaidAmount),
        remainingAmount: numberValue(row.RemainingAmount),
        paymentMode: clean(row.PaymentMode) || "Cash",
        receivedBy: clean(row.ReceivedBy),
        notes: clean(row.Notes),
        paymentDate: dateValue(row.Date) || new Date().toISOString().slice(0, 10),
        createdByUserId: usersByName.get(nameKey(row.ReceivedBy))?._id || fallbackAdmin._id,
        assignedToUserId: lead.assignedToUserId,
        assignedByUserId: lead.assignedByUserId,
      });
    }
  }

  for (const row of sheetRows.invoices) {
    const lead = await legacyLead(row, "invoices");
    if (!lead) continue;
    const found = await GstInvoice.findOne({ invoiceNo: clean(row.InvoiceNo) });
    if (found) {
      report.invoices.update += options.overwrite ? 1 : 0;
      continue;
    }
    report.invoices.create += 1;
    if (options.commit) {
      await GstInvoice.create({
        invoiceNo: await makeUniqueNo(GstInvoice, "invoiceNo", row.InvoiceNo, "GST"),
        leadId: lead._id,
        leadName: clean(row.LeadName) || lead.customerName,
        phone: clean(row.Phone) || lead.phone,
        whatsappNumber: lead.whatsappNumber,
        email: lead.email,
        customerName: clean(row.LeadName) || lead.customerName,
        address: lead.address,
        taxableAmount: numberValue(row.TaxableAmt),
        cgst: numberValue(row.CGST),
        sgst: numberValue(row.SGST),
        notes: `Imported legacy total amount: ${numberValue(row.TotalAmt)}`,
        createdByUserId: usersByName.get(nameKey(row.GeneratedBy))?._id || fallbackAdmin._id,
        assignedToUserId: lead.assignedToUserId,
        assignedByUserId: lead.assignedByUserId,
      });
    }
  }

  report.warnings = report.warnings.slice(0, 100);
  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
