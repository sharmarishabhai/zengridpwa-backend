require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../src/models/Lead");
const Plant = require("../src/models/Plant");
const User = require("../src/models/User");

const rows = `KAMLESH PRATAP YADAV|9559880022|26.990882|80.940043
BHARAT SINGH|9792998555|26.874969|81.039218
PREETI AGRAWAL|7355997708|26.940757|80.937978
SANJEEV JAUHARY|7007950043|26.844806|80.922874
RNS RAJAWAT|9389197991|26.901177|80.96338
NEERAJ SINGH|9415455155|26.882718|81.003358
MOHD ALIM|9005621550|26.874116|80.857292
SHAMSHAD KHAN|7376073799|26.794622|80.925733
PRIYA SRIVASTAVA|9569620492|26.7780667|81.0335983
RAKESH KUSHWAHA|8604618091|26.756526|80.929035
MUKESH KUSHWAHA|9935111975|26.75655|80.929603
IFFAT MEHDI|8687871162|26.875769|80.89582
CHANDRA KISHOR MISHRA|9415941595|26.776746|80.927069
WASEEM AKRAM|7905643045|26.934111|80.941795
SHWETA KHAWTRA|6393162005|26.901846|80.003038
JAG PRASAD YADAV|9415425721|26.909343|80.964658
RAM PATI|8957858499|26.779478|80.965998
DEEPMALA DWIVEDI|8707752158|26.840938|81.027456
AASHARAM GUPTA|9415575871|26.82886|80.872638
MADHURI GOYAL|9839828499|26.785082|80.893046
RAM NAYAK|9795960016|26.895501|81.018484
SARSWATI CHAUDHARY|8853819691|26.831563|80.004274
HARSHIT BAJPAI|7379475666|26.842336|80.011199
FAISAL WASEE|7000258744|26.934833|80.936614
RANI BEGAM|6307901783|26.861275|80.873027
NARENDRA SINGH|9936622841|26.879769|80.952838
SHIV PATI|8172840654|26.878624|80.881685
RATI SHUKLA|9415314600|26.878648|81.008879
RAHUL VERMA|9120891954|26.938931|80.984639
CHANRA BHAAN|7318270609|26.881132|81.018773
VIJAY KUMAR|9936811915|26.758028|80.917661
MADHURIMA SHUKLA|9793062333||
RAJEEV RASTOGI|9935364087|26.766759|80.943022
SANJAY KUMAR UPADHAY|8400110088|26.78473|80.965469
JAYA SINGH|9839656666|26.901707|81.003051
SUDHA YADAV|8957505585|26.817725|80.869148`.split("\n").map((line) => { const [name, phone, lat, lng] = line.split("|"); return { name, phone, lat, lng }; });

const normalizePhone = (v) => String(v || "").replace(/\D/g, "").slice(-10);
(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const admin = await User.findOne({ userType: "admin", status: { $ne: "inactive" } });
  if (!admin) throw new Error("No active admin user found");
  const result = { total: rows.length, upserted: 0, updated: 0, skippedNoCoordinates: 0, unmatched: [] };
  for (const row of rows) {
    if (!row.lat || !row.lng) { result.skippedNoCoordinates += 1; continue; }
    let lead = await Lead.findOne({ phone: { $in: [row.phone, normalizePhone(row.phone)] } });
    if (!lead) {
      lead = await Lead.create({ customerName: row.name, phone: normalizePhone(row.phone), leadId: `PLANT-${normalizePhone(row.phone)}`, source: "Import", leadStatus: "Won", note: "Created from installed plant location import.", createdByRole: admin.userType, createdByUserId: admin._id, updatedByUserId: admin._id });
      result.unmatched.push({ name: row.name, phone: row.phone, action: "created customer" });
    }
    const existing = await Plant.exists({ leadId: lead._id });
    await Plant.findOneAndUpdate({ leadId: lead._id }, { leadId: lead._id, latitude: Number(row.lat), longitude: Number(row.lng), locationLabel: "Installed plant", createdBy: admin._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (existing) result.updated += 1; else result.upserted += 1;
  }
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
})().catch(async (err) => { console.error(err.message); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
