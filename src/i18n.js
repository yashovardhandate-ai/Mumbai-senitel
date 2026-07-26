// Translation dictionary for Mumbai Sentinel.
// en = English, hi = Hindi (Devanagari), mr = Marathi (Devanagari).
//
// NOTE: Hindi and Marathi drafts were produced by Claude and should be
// reviewed by a native speaker before being relied on -- especially Marathi.
// Civic wording ("Blockage", "Mark resolved", "Flood/Disaster") is easy to
// get subtly wrong; corrections welcome.

export const LANGUAGES = [
  { code: "en", label: "EN", name: "English" },
  { code: "hi", label: "हि", name: "हिंदी" },
  { code: "mr", label: "मरा", name: "मराठी" },
];

export const STRINGS = {
  // Category names (incidents)
  "cat.traffic": { en: "Traffic Jam", hi: "ट्रैफिक जाम", mr: "वाहतूक कोंडी" },
  "cat.blockage": { en: "Blockage", hi: "रुकावट", mr: "अडथळा" },
  "cat.fire": { en: "Fire", hi: "आग", mr: "आग" },
  "cat.flood": { en: "Flood / Disaster", hi: "बाढ़ / आपदा", mr: "पूर / आपत्ती" },
  "cat.other": { en: "Other Issue", hi: "अन्य समस्या", mr: "इतर समस्या" },
  "cat.monsoon": { en: "Monsoon Hazard", hi: "मानसून खतरा", mr: "पावसाळी धोका" },

  // Monsoon sub-types
  "sub.waterlogging": { en: "Waterlogging", hi: "जलभराव", mr: "पाणी साचणे" },
  "sub.treefall": { en: "Tree / branch fall", hi: "पेड़ / शाखा गिरना", mr: "झाड / फांदी पडणे" },
  "sub.manhole": { en: "Open manhole / drain", hi: "खुला मैनहोल / नाला", mr: "उघडे मॅनहोल / गटार" },
  "sub.wall": { en: "Wall / structure danger", hi: "दीवार / ढांचे का खतरा", mr: "भिंत / बांधकाम धोका" },
  "sub.power": { en: "Power outage", hi: "बिजली गुल", mr: "वीज खंडित" },
  "sub.other": { en: "Other monsoon hazard", hi: "अन्य मानसून खतरा", mr: "इतर पावसाळी धोका" },
  "report.subtype": { en: "Type of hazard", hi: "खतरे का प्रकार", mr: "धोक्याचा प्रकार" },

  // Directory category names
  "dir.police": { en: "Police", hi: "पुलिस", mr: "पोलीस" },
  "dir.fire": { en: "Fire", hi: "अग्निशमन", mr: "अग्निशमन" },
  "dir.medical": { en: "Medical", hi: "चिकित्सा", mr: "वैद्यकीय" },
  "dir.bmc": { en: "BMC / Civic", hi: "बीएमसी / नागरिक", mr: "बीएमसी / नागरी" },
  "dir.pwd": { en: "PWD / CPWD", hi: "पीडब्ल्यूडी", mr: "सार्वजनिक बांधकाम" },
  "dir.other": { en: "Other", hi: "अन्य", mr: "इतर" },

  // Header / nav
  "nav.map": { en: "Map", hi: "नक्शा", mr: "नकाशा" },
  "nav.directory": { en: "Directory", hi: "निर्देशिका", mr: "निर्देशिका" },
  "nav.report": { en: "Report incident", hi: "घटना दर्ज करें", mr: "घटना नोंदवा" },
  "nav.getAlerts": { en: "Get alerts", hi: "अलर्ट पाएं", mr: "सूचना मिळवा" },
  "nav.alertsOn": { en: "Alerts on", hi: "अलर्ट चालू", mr: "सूचना सुरू" },
  "nav.alertsOnTip": { en: "Alerts on — tap to turn off", hi: "अलर्ट चालू — बंद करने के लिए टैप करें", mr: "सूचना सुरू — बंद करण्यासाठी टॅप करा" },
  "nav.getAlertsTip": { en: "Get alerts for incidents near you", hi: "अपने पास की घटनाओं के लिए अलर्ट पाएं", mr: "तुमच्या जवळील घटनांसाठी सूचना मिळवा" },

  // Home screen
  "home.tagline": {
    en: "Report incidents anytime, anywhere — Mumbai's own incident reporting network.",
    hi: "कभी भी, कहीं भी घटनाएं दर्ज करें — मुंबई का अपना घटना रिपोर्टिंग नेटवर्क।",
    mr: "कधीही, कुठेही घटना नोंदवा — मुंबईचे स्वतःचे घटना नोंदणी जाळे.",
  },
  "home.report": { en: "Report Incident", hi: "घटना दर्ज करें", mr: "घटना नोंदवा" },
  "home.goMap": { en: "Go to Map", hi: "नक्शे पर जाएं", mr: "नकाशाकडे जा" },
  "home.goDirectory": { en: "Go to Directory", hi: "निर्देशिका पर जाएं", mr: "निर्देशिकेकडे जा" },

  // Map / incident list
  "map.activeOne": { en: "active incident", hi: "सक्रिय घटना", mr: "सक्रिय घटना" },
  "map.activeMany": { en: "active incidents", hi: "सक्रिय घटनाएं", mr: "सक्रिय घटना" },
  "map.empty": { en: "No incidents reported in this view yet.", hi: "इस क्षेत्र में अभी तक कोई घटना दर्ज नहीं हुई।", mr: "या भागात अद्याप कोणतीही घटना नोंदवली गेली नाही." },
  "map.tapPin": { en: "Tap anywhere on the map to drop your pin", hi: "अपना पिन लगाने के लिए नक्शे पर कहीं भी टैप करें", mr: "तुमचा पिन ठेवण्यासाठी नकाशावर कुठेही टॅप करा" },
  "map.expiresIn": { en: "expires in", hi: "समाप्त होगा", mr: "कालबाह्य होईल" },

  // Confirm ("I see this too")
  "confirm.action": { en: "I see this too", hi: "मैं भी यह देख रहा हूं", mr: "मलाही हे दिसत आहे" },
  "confirm.done": { en: "You confirmed this", hi: "आपने इसकी पुष्टि की", mr: "तुम्ही याची पुष्टी केली" },
  "confirm.readonlyOne": { en: "person confirms this", hi: "व्यक्ति ने पुष्टि की", mr: "व्यक्तीने पुष्टी केली" },
  "confirm.readonlyMany": { en: "people confirm this", hi: "लोगों ने पुष्टि की", mr: "लोकांनी पुष्टी केली" },

  // Vote / resolve
  "inc.markResolved": { en: "Mark resolved", hi: "हल हो गया", mr: "हे सोडवले असे दाखवा" },

  // Report modal
  "report.title": { en: "Report an incident", hi: "घटना दर्ज करें", mr: "घटना नोंदवा" },
  "report.location": { en: "Location", hi: "स्थान", mr: "स्थान" },
  "report.category": { en: "Category", hi: "श्रेणी", mr: "श्रेणी" },
  "report.whatHappening": { en: "What's happening?", hi: "क्या हो रहा है?", mr: "काय घडत आहे?" },
  "report.descPlaceholder": { en: "Brief description of the incident", hi: "घटना का संक्षिप्त विवरण", mr: "घटनेचे थोडक्यात वर्णन" },
  "report.photo": { en: "Photo (optional)", hi: "फोटो (वैकल्पिक)", mr: "फोटो (ऐच्छिक)" },
  "report.addPhoto": { en: "Add a photo", hi: "फोटो जोड़ें", mr: "फोटो जोडा" },
  "report.uploading": { en: "Uploading…", hi: "अपलोड हो रहा है…", mr: "अपलोड होत आहे…" },
  "report.yourName": { en: "Your name", hi: "आपका नाम", mr: "तुमचे नाव" },
  "report.namePlaceholder": { en: "Full name", hi: "पूरा नाम", mr: "पूर्ण नाव" },
  "report.phone": { en: "Phone number", hi: "फोन नंबर", mr: "फोन नंबर" },
  "report.dropPin": { en: "Tap to drop pin on map", hi: "नक्शे पर पिन लगाने के लिए टैप करें", mr: "नकाशावर पिन ठेवण्यासाठी टॅप करा" },
  "report.submit": { en: "Submit report", hi: "रिपोर्ट जमा करें", mr: "अहवाल सादर करा" },
  "report.submitting": { en: "Submitting…", hi: "जमा हो रहा है…", mr: "सादर होत आहे…" },
  "report.change": { en: "change", hi: "बदलें", mr: "बदला" },
  "report.remove": { en: "Remove", hi: "हटाएं", mr: "काढा" },
  "report.dropPinBtn": { en: "Tap to drop a pin on the map", hi: "नक्शे पर पिन लगाने के लिए टैप करें", mr: "नकाशावर पिन ठेवण्यासाठी टॅप करा" },
  "report.phonePlaceholder": { en: "10-digit number", hi: "10 अंकों का नंबर", mr: "10 अंकी नंबर" },
  "report.privacyNote": {
    en: "Your name and number help others trust the report. Only your name is shown publicly — not your phone number.",
    hi: "आपका नाम और नंबर दूसरों को रिपोर्ट पर भरोसा करने में मदद करते हैं। सार्वजनिक रूप से केवल आपका नाम दिखता है — फोन नंबर नहीं।",
    mr: "तुमचे नाव आणि नंबर इतरांना अहवालावर विश्वास ठेवण्यास मदत करतात. सार्वजनिकरित्या फक्त तुमचे नाव दाखवले जाते — फोन नंबर नाही.",
  },

  // Name prompt
  "name.title": { en: "Your name", hi: "आपका नाम", mr: "तुमचे नाव" },
  "name.blurb": {
    en: "We ask once so votes are tied to a real person, not anonymous clicks. Your browser will remember it after this.",
    hi: "हम एक बार पूछते हैं ताकि वोट किसी असली व्यक्ति से जुड़े हों, गुमनाम क्लिक से नहीं। इसके बाद आपका ब्राउज़र इसे याद रखेगा।",
    mr: "आम्ही एकदाच विचारतो जेणेकरून मते खऱ्या व्यक्तीशी जोडली जातील, निनावी क्लिकशी नाही. यानंतर तुमचा ब्राउझर ते लक्षात ठेवेल.",
  },
  "name.continue": { en: "Continue", hi: "आगे बढ़ें", mr: "पुढे चला" },

  // Directory
  "dir.search": { en: "Search by name or area…", hi: "नाम या क्षेत्र से खोजें…", mr: "नाव किंवा भागानुसार शोधा…" },
  "dir.empty": { en: "No contacts match this search.", hi: "इस खोज से कोई संपर्क मेल नहीं खाता।", mr: "या शोधाशी जुळणारे संपर्क नाहीत." },
  "dir.all": { en: "All", hi: "सभी", mr: "सर्व" },
  "dir.reportIncorrect": { en: "Report incorrect", hi: "गलत जानकारी बताएं", mr: "चुकीची माहिती कळवा" },
  "dir.reportThanks": { en: "Thanks — we'll check this", hi: "धन्यवाद — हम इसे जांचेंगे", mr: "धन्यवाद — आम्ही हे तपासू" },
  "dir.nearest": { en: "Nearest to me", hi: "मेरे सबसे पास", mr: "माझ्या सर्वात जवळ" },
  "dir.locating": { en: "Finding you…", hi: "आपको ढूंढ रहे हैं…", mr: "तुम्हाला शोधत आहे…" },
  "dir.km": { en: "km", hi: "कि.मी.", mr: "कि.मी." },
  "dir.locationDenied": { en: "Location unavailable — check permissions.", hi: "स्थान अनुपलब्ध — अनुमतियां जांचें।", mr: "स्थान उपलब्ध नाही — परवानग्या तपासा." },

  // Report-incorrect modal
  "rc.title": { en: "Report incorrect details", hi: "गलत विवरण बताएं", mr: "चुकीचा तपशील कळवा" },
  "rc.whatsWrong": { en: "What's wrong?", hi: "क्या गलत है?", mr: "काय चुकीचे आहे?" },
  "rc.details": { en: "Details (optional)", hi: "विवरण (वैकल्पिक)", mr: "तपशील (ऐच्छिक)" },
  "rc.detailsPlaceholder": { en: "e.g. the correct number is…", hi: "जैसे सही नंबर है…", mr: "उदा. योग्य नंबर आहे…" },
  "rc.send": { en: "Send report", hi: "रिपोर्ट भेजें", mr: "अहवाल पाठवा" },
  "rc.sending": { en: "Sending…", hi: "भेजा जा रहा है…", mr: "पाठवत आहे…" },
  "rc.reasonDead": { en: "Number doesn't connect", hi: "नंबर नहीं लगता", mr: "नंबर लागत नाही" },
  "rc.reasonWrong": { en: "Wrong number / someone else", hi: "गलत नंबर / कोई और", mr: "चुकीचा नंबर / दुसरेच कोणी" },
  "rc.reasonAddress": { en: "Address is wrong", hi: "पता गलत है", mr: "पत्ता चुकीचा आहे" },
  "rc.reasonMoved": { en: "Office moved or closed", hi: "कार्यालय स्थानांतरित या बंद", mr: "कार्यालय हलवले किंवा बंद झाले" },
  "rc.reasonOther": { en: "Something else", hi: "कुछ और", mr: "इतर काही" },

  // Common
  "common.cancel": { en: "Cancel", hi: "रद्द करें", mr: "रद्द करा" },
  "common.close": { en: "Close", hi: "बंद करें", mr: "बंद करा" },
  "common.save": { en: "Save", hi: "सहेजें", mr: "जतन करा" },
  "common.loading": { en: "Loading…", hi: "लोड हो रहा है…", mr: "लोड होत आहे…" },
  "common.findLocation": { en: "Find my location", hi: "मेरा स्थान खोजें", mr: "माझे स्थान शोधा" },

  // Office pins panel
  "pins.title": { en: "Office pins", hi: "कार्यालय पिन", mr: "कार्यालय पिन" },

  // Errors (kept short; prefix + raw message appended in code)
  "err.loadIncidents": { en: "Couldn't load incidents: ", hi: "घटनाएं लोड नहीं हो सकीं: ", mr: "घटना लोड होऊ शकल्या नाहीत: " },
  "err.loadDirectory": { en: "Couldn't load directory: ", hi: "निर्देशिका लोड नहीं हो सकी: ", mr: "निर्देशिका लोड होऊ शकली नाही: " },
  "err.submit": { en: "Couldn't submit: ", hi: "जमा नहीं हो सका: ", mr: "सादर होऊ शकले नाही: " },
  "err.resolve": { en: "Couldn't mark resolved: ", hi: "हल चिह्नित नहीं हो सका: ", mr: "निराकरण चिन्हांकित होऊ शकले नाही: " },
  "err.vote": { en: "Couldn't register your vote: ", hi: "आपका वोट दर्ज नहीं हो सका: ", mr: "तुमचे मत नोंदवले जाऊ शकले नाही: " },
  "err.confirm": { en: "Couldn't confirm: ", hi: "पुष्टि नहीं हो सकी: ", mr: "पुष्टी होऊ शकली नाही: " },
  "err.photo": { en: "Couldn't upload photo: ", hi: "फोटो अपलोड नहीं हो सका: ", mr: "फोटो अपलोड होऊ शकला नाही: " },
  "err.locationUnavailable": { en: "Location isn't available on this device.", hi: "इस डिवाइस पर स्थान उपलब्ध नहीं है।", mr: "या उपकरणावर स्थान उपलब्ध नाही." },
  "err.locationFailed": { en: "Couldn't get your location. Check location permissions.", hi: "आपका स्थान नहीं मिल सका। स्थान अनुमतियां जांचें।", mr: "तुमचे स्थान मिळू शकले नाही. स्थान परवानग्या तपासा." },
  "err.alertsConfig": { en: "Alerts aren't configured yet.", hi: "अलर्ट अभी कॉन्फ़िगर नहीं हैं।", mr: "सूचना अद्याप कॉन्फिगर केलेल्या नाहीत." },
  "err.alertsPermission": { en: "Alerts need notification permission. Enable it in browser settings.", hi: "अलर्ट के लिए सूचना अनुमति चाहिए। इसे ब्राउज़र सेटिंग में चालू करें।", mr: "सूचनांसाठी परवानगी आवश्यक आहे. ती ब्राउझर सेटिंग्जमध्ये सुरू करा." },
  "err.alertsSetup": { en: "Couldn't set up alerts: ", hi: "अलर्ट सेट नहीं हो सके: ", mr: "सूचना सेट होऊ शकल्या नाहीत: " },
  "err.reportSend": { en: "Couldn't send: ", hi: "भेजा नहीं जा सका: ", mr: "पाठवता आले नाही: " },
};

export function makeT(lang) {
  return (key) => {
    const entry = STRINGS[key];
    if (!entry) return key; // fail visible, not silent
    return entry[lang] ?? entry.en ?? key;
  };
}
