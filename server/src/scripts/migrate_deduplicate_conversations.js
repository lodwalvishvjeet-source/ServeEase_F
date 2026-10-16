import '../config/env.js';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

/**
 * Database Migration Script: Deduplicate Conversations & Enforce Database-Level Uniqueness
 * 
 * 1. Identifies all duplicate conversation documents between the same participant pair
 * 2. Reassigns all messages from duplicates to the canonical conversation
 * 3. Safely removes the duplicate conversation documents
 * 4. Populates the canonical `pairKey` field for every conversation
 * 5. Applies a compound unique index on `{ pairKey: 1 }`
 */
const runMigration = async () => {
  console.log('================================================================');
  console.log('🛠️  ServeEase — Conversation Deduplication & Index Migration');
  console.log('================================================================');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to database:', mongoose.connection.name);

    const allConversations = await Conversation.find({}).lean();
    console.log(`📊 Found ${allConversations.length} total conversation documents in database.`);

    // Group conversations by canonical pair key
    const groups = new Map();

    for (const conv of allConversations) {
      if (!Array.isArray(conv.participants) || conv.participants.length < 2) {
        console.warn(`⚠️ Conversation ${conv._id} has invalid participants (${conv.participants?.length}). Skipping.`);
        continue;
      }

      const sortedParticipants = conv.participants
        .map((p) => (p._id || p).toString())
        .sort((a, b) => a.localeCompare(b));

      const bookingPart = conv.booking ? `:${conv.booking.toString()}` : '';
      const pairKey = `${sortedParticipants.join(':')}${bookingPart}`;

      if (!groups.has(pairKey)) {
        groups.set(pairKey, []);
      }
      groups.get(pairKey).push(conv);
    }

    let duplicateGroupsCount = 0;
    let deletedDocsCount = 0;
    let reassignedMessagesCount = 0;

    console.log(`🔍 Analyzed ${groups.size} unique logical conversation channels.`);

    for (const [pairKey, convs] of groups.entries()) {
      if (convs.length > 1) {
        duplicateGroupsCount++;
        console.log(`\n⚠️ Duplicate group detected for pairKey "${pairKey}" (${convs.length} documents):`);

        // Fetch message counts for each candidate
        const candidates = [];
        for (const c of convs) {
          const msgCount = await Message.countDocuments({ conversation: c._id });
          candidates.push({ conv: c, msgCount });
          console.log(`   - Conv ID ${c._id} (updated: ${c.updatedAt || 'N/A'}, msgs: ${msgCount})`);
        }

        // Sort: highest message count first, then latest updatedAt
        candidates.sort((a, b) => {
          if (b.msgCount !== a.msgCount) return b.msgCount - a.msgCount;
          const timeA = new Date(a.conv.updatedAt || a.conv.createdAt || 0).getTime();
          const timeB = new Date(b.conv.updatedAt || b.conv.createdAt || 0).getTime();
          return timeB - timeA;
        });

        const canonical = candidates[0].conv;
        console.log(`   👉 Selected canonical: ${canonical._id} (${candidates[0].msgCount} msgs)`);

        // Migrate messages from non-canonical duplicates and delete duplicates
        for (let i = 1; i < candidates.length; i++) {
          const duplicate = candidates[i].conv;
          const dupId = duplicate._id;

          const moveResult = await Message.updateMany(
            { conversation: dupId },
            { $set: { conversation: canonical._id } }
          );

          if (moveResult.modifiedCount > 0) {
            console.log(`   📦 Reassigned ${moveResult.modifiedCount} messages from ${dupId} to canonical ${canonical._id}`);
            reassignedMessagesCount += moveResult.modifiedCount;
          }

          await Conversation.deleteOne({ _id: dupId });
          console.log(`   🗑️  Deleted duplicate conversation document ${dupId}`);
          deletedDocsCount++;
        }

        // Set pairKey on canonical conversation
        await Conversation.updateOne(
          { _id: canonical._id },
          { $set: { pairKey } }
        );
      } else {
        // Single conversation in group: set pairKey
        await Conversation.updateOne(
          { _id: convs[0]._id },
          { $set: { pairKey } }
        );
      }
    }

    console.log('\n================================================================');
    console.log('📈 Deduplication Results:');
    console.log(`   - Duplicate groups resolved: ${duplicateGroupsCount}`);
    console.log(`   - Messages safely reassigned: ${reassignedMessagesCount}`);
    console.log(`   - Duplicate documents removed: ${deletedDocsCount}`);
    const remainingCount = await Conversation.countDocuments({});
    console.log(`   - Total active conversations remaining: ${remainingCount}`);
    console.log('================================================================');

    // Create unique index on pairKey
    console.log('\n⏳ Enforcing unique index on { pairKey: 1 }...');
    try {
      await Conversation.collection.createIndex(
        { pairKey: 1 },
        { unique: true, sparse: true, name: 'pairKey_1_unique' }
      );
      console.log('✅ Index "pairKey_1_unique" successfully established in MongoDB!');
    } catch (indexError) {
      console.error('❌ Failed to create unique index:', indexError.message);
      throw indexError;
    }

    console.log('\n✨ Database migration completed successfully!');
  } catch (error) {
    console.error('💥 Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from database.');
  }
};

runMigration();
