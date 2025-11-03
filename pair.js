

import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser } from '@whiskeysockets/baileys';
import { upload } from './mega.js';

const router = express.Router();

// Ensure the session directory exists
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || `session`);
    
    // Remove existing session if present
    await removeFile(dirs);
    
    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            let SUPUNMDInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!SUPUNMDInc.authState.creds.registered) {
                await delay(2000);
                num = num.replace(/[^0-9]/g, '');
                const code = await SUPUNMDInc.requestPairingCode(num);
                if (!res.headersSent) {
                    console.log({ num, code });
                    await res.send({ code });
                }
            }

            SUPUNMDInc.ev.on('creds.update', saveCreds);
            SUPUNMDInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(10000);
                    const sessionGlobal = fs.readFileSync(dirs + '/creds.json');

                    // Helper to generate a random Mega file ID
                    function generateRandomId(length = 6, numberLength = 4) {
                        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                        let result = '';
                        for (let i = 0; i < length; i++) {
                            result += characters.charAt(Math.floor(Math.random() * characters.length));
                        }
                        const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                        return `${result}${number}`;
                    }

                    // Upload session file to Mega
                    const megaUrl = await upload(fs.createReadStream(`${dirs}/creds.json`), `${generateRandomId()}.json`);
                    let stringSession = megaUrl.replace('https://mega.nz/file/', ''); // Extract session ID from URL
                    stringSession = 'RASHU-MD=' + stringSession;  // Prepend your name to the session ID

                    // Send the session ID to the target number
                    const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                    await SUPUNMDInc.sendMessage(userJid, { text: stringSession });

                    // Send confirmation message
                    await SUPUNMDInc.sendMessage(userJid, { text: "*🪄 𝐐𝐔𝐄𝐄𝐍 𝐑𝐀𝐒𝐇𝐔 𝐌𝐃 𝐁𝐄𝐓𝐀 𝐒𝐄𝐒𝐒𝐈𝐎𝐍 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋 ✅*\n\n*මුලින්ම ඔයාට ආපු CODE එක COPY කරගෙන පහල තියෙන FREE DEPLOY කියන LINK එක ටච් කරලා SITE එකට ගිහිම් ඔයාගෙ නම (සිම්පල් අකුරු පමණක්) බාවිතා කර ඔයාගෙ නම්බර් එකත් එක්ක උදා : 👉 rashu0727319036 👈 මේ විදිහට TYPE කරලා පහල තැනට ඔයාට මුලින්ම ආපු CODE එක PAST කරන්න.*\n\n*අවසානෙට DEPLOY BOT කියන BUTTON එක ටච් කරන්න ඔයා උඩ කියපු විදිහටම කරානම් විනාඩි  3-5 ත් අතර කාලයක් තුල QUEEN RASHU MD BETA UPDATE එක DEPLOY වෙනවා 😚*\n+ ┉┉┉┉┉┉┉┉[ 🔞 ]┉┉┉┉┉┉┉┉ +\n\nFirst, copy the CODE you received and tap the FREE DEPLOY link below. After going to the site, use your name (only simple letters) along with your number. Example: 👉 rashu0727319036 👈 Type it like this, and then paste the CODE you received earlier in the space below.\n\nFinally, tap the DEPLOY BOT button. If you follow the steps exactly as explained, within 3–5 minutes the QUEEN RASHU MD BETA UPDATE will be deployed 😚\n\n*⭕ 𝗙𝗥𝗘𝗘 𝗗𝗘𝗣𝗟𝗢𝗬 :*\n> https://rashu-free-web-a1b0981602bb.herokuapp.com/\n*⭕ 𝗥𝗔𝗦𝗛𝗨 𝗢𝗪𝗡𝗘𝗥 :*\n> https://wa.me/message/5ZZGFAM3W5S4E1\n\n*● 𝗧𝗵𝗮𝗻𝗸𝘀 𝗙𝗼𝗿 𝗬𝗼𝘂𝘀𝗲𝗿 ......😚*\n\n> 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝐐𝐔𝐄𝐄𝐍 𝐑𝐀𝐒𝐇𝐔 𝐌𝐃 𝙾𝙵𝙲 🫟" });
                    
                    // Clean up session after use
                    await delay(100);
                    removeFile(dirs);
                    process.exit(0);
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    console.log('Connection closed unexpectedly:', lastDisconnect.error);
                    await delay(10000);
                    initiateSession(); // Retry session initiation if needed
                }
            });
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    console.log('Caught exception: ' + err);
});

export default router;
