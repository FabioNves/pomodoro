const mongoose = require("mongoose");
require("dotenv").config();

async function migrateData() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "pomodoro-app",
    });

    console.log("Connected to MongoDB");

    const yourGoogleUserId = "100206651812315314101"; // Your Google user ID

    // Get the raw database connection to bypass Mongoose schemas
    const db = mongoose.connection.db;

    // First, let's see what data we have
    const sessionsCount = await db.collection("sessions").countDocuments();
    const milestonesCount = await db.collection("milestones").countDocuments();
    const brandsCount = await db.collection("brands").countDocuments();

    console.log(
      `Found ${sessionsCount} sessions, ${milestonesCount} milestones, ${brandsCount} brands`
    );

    // Migrate Sessions - convert ObjectId users to string
    const sessionsResult = await db.collection("sessions").updateMany(
      { user: { $type: "objectId" } }, // Find documents where user is ObjectId
      { $set: { user: yourGoogleUserId } }
    );
    console.log(`Migrated ${sessionsResult.modifiedCount} sessions`);

    // Also migrate any sessions where user field might be missing or null
    const sessionsNullResult = await db
      .collection("sessions")
      .updateMany(
        { $or: [{ user: null }, { user: { $exists: false } }] },
        { $set: { user: yourGoogleUserId } }
      );
    console.log(
      `Migrated ${sessionsNullResult.modifiedCount} sessions with null/missing user`
    );

    // Migrate Milestones
    const milestonesResult = await db
      .collection("milestones")
      .updateMany(
        { user: { $type: "objectId" } },
        { $set: { user: yourGoogleUserId } }
      );
    console.log(`Migrated ${milestonesResult.modifiedCount} milestones`);

    // Also migrate milestones with null/missing user
    const milestonesNullResult = await db
      .collection("milestones")
      .updateMany(
        { $or: [{ user: null }, { user: { $exists: false } }] },
        { $set: { user: yourGoogleUserId } }
      );
    console.log(
      `Migrated ${milestonesNullResult.modifiedCount} milestones with null/missing user`
    );

    // Migrate Brands
    const brandsResult = await db
      .collection("brands")
      .updateMany(
        { user: { $type: "objectId" } },
        { $set: { user: yourGoogleUserId } }
      );
    console.log(`Migrated ${brandsResult.modifiedCount} brands`);

    // Also migrate brands with null/missing user
    const brandsNullResult = await db
      .collection("brands")
      .updateMany(
        { $or: [{ user: null }, { user: { $exists: false } }] },
        { $set: { user: yourGoogleUserId } }
      );
    console.log(
      `Migrated ${brandsNullResult.modifiedCount} brands with null/missing user`
    );

    // Let's also check for any documents that might have string ObjectIds
    const sessionsStringObjectId = await db.collection("sessions").updateMany(
      { user: { $type: "string", $regex: /^[0-9a-fA-F]{24}$/ } }, // 24-char hex strings (ObjectId as string)
      { $set: { user: yourGoogleUserId } }
    );
    console.log(
      `Migrated ${sessionsStringObjectId.modifiedCount} sessions with string ObjectIds`
    );

    console.log("Migration completed successfully!");

    // Show final counts
    const finalSessionsWithUser = await db
      .collection("sessions")
      .countDocuments({ user: yourGoogleUserId });
    const finalMilestonesWithUser = await db
      .collection("milestones")
      .countDocuments({ user: yourGoogleUserId });
    const finalBrandsWithUser = await db
      .collection("brands")
      .countDocuments({ user: yourGoogleUserId });

    console.log(`Final counts assigned to your user ID:`);
    console.log(`- Sessions: ${finalSessionsWithUser}`);
    console.log(`- Milestones: ${finalMilestonesWithUser}`);
    console.log(`- Brands: ${finalBrandsWithUser}`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateData();
