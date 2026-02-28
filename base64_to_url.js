async function migrateAllToBase64AndNewFields() {
    const db = firebase.firestore();
    const storage = firebase.storage();
    const colName = 'expenseReceipts'; // ชื่อคอลเลกชันตาม Rules
    
    console.log("🎬 เริ่มกระบวนการย้ายข้อมูลทั้งระบบ...");

    try {
        const snapshot = await db.collection(colName).get();
        console.log(`📦 พบข้อมูลทั้งหมด ${snapshot.size} รายการ`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const docId = doc.id;
            let updateData = {};
            let needsUpdate = false;

            try {
                // --- 1. จัดการรูปใบเสร็จ (ย้าย Base64 -> Storage และเปลี่ยนชื่อฟิลด์) ---
                const oldReceipt = data.receiptImages || data.receiptImage || data.image;
                const receiptBase64 = Array.isArray(oldReceipt) ? oldReceipt[0] : oldReceipt;

                if (receiptBase64 && typeof receiptBase64 === 'string' && receiptBase64.startsWith('data:image')) {
                    console.log(`📸 [${docId}] กำลังย้ายรูปใบเสร็จ...`);
                    const ref = storage.ref(`receipts/receipt_${docId}_${Date.now()}.jpg`);
                    const upload = await ref.putString(receiptBase64, 'data_url');
                    const url = await upload.ref.getDownloadURL();
                    
                    updateData.receiptImageUrls = [url]; // ชื่อใหม่ (Array)
                    updateData.receiptImages = firebase.firestore.FieldValue.delete(); // ลบชื่อเก่า
                    updateData.receiptImage = firebase.firestore.FieldValue.delete();
                    updateData.image = firebase.firestore.FieldValue.delete();
                    needsUpdate = true;
                }

                // --- 2. จัดการลายเซ็น (ย้าย Base64 -> Storage และเปลี่ยนชื่อฟิลด์) ---
                const oldSig = data.signatureData || data.signature;
                if (oldSig && typeof oldSig === 'string' && oldSig.startsWith('data:image')) {
                    console.log(`✍️ [${docId}] กำลังย้ายลายเซ็น...`);
                    const ref = storage.ref(`signatures/sig_${docId}.png`);
                    const upload = await ref.putString(oldSig, 'data_url');
                    const url = await upload.ref.getDownloadURL();
                    
                    updateData.signatureUrl = url; // ชื่อใหม่ (String)
                    updateData.signatureData = firebase.firestore.FieldValue.delete(); // ลบชื่อเก่า
                    updateData.signature = firebase.firestore.FieldValue.delete();
                    needsUpdate = true;
                }

                // --- 3. อัปเดตข้อมูลกลับไปยัง Firestore ---
                if (needsUpdate) {
                    await db.collection(colName).doc(docId).update(updateData);
                    successCount++;
                    console.log(`✅ [${docId}] สำเร็จ`);
                } else {
                    skipCount++;
                }
            } catch (innerError) {
                console.error(`❌ [${docId}] พัง:`, innerError.message);
                errorCount++;
            }
        }

        console.log("----------------------------");
        console.log(`🏁 ภารกิจเสร็จสิ้น!`);
        console.log(`✅ อัปเดตสำเร็จ: ${successCount} รายการ`);
        console.log(`⏭️ ข้ามไป (เป็น URL อยู่แล้ว): ${skipCount} รายการ`);
        if (errorCount > 0) console.log(`⚠️ ข้อผิดพลาด: ${errorCount} รายการ`);
        
        alert(`ดำเนินการเสร็จสิ้น! อัปเดตไปทั้งหมด ${successCount} รายการครับ`);

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดร้ายแรง:", error);
    }
}

// เริ่มรัน
migrateAllToBase64AndNewFields();