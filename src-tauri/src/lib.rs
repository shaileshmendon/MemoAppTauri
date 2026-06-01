// ── macOS Contacts import ─────────────────────────────────────────────────────
//
// Uses osascript / JXA (JavaScript for Automation) so that:
//   • The TCC Contacts permission prompt is attributed to *this app*.
//   • No extra Rust crates are required.
//   • We get structured JSON back without messy AppleScript string handling.
//
// The command is async + spawn_blocking so it never stalls the Tauri IPC
// thread.  The JXA uses app.people.whose() so filtering happens inside the
// Contacts process — we never load the full address book into memory.

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MacContact {
    pub name:           String,
    pub given_name:     String,
    pub family_name:    String,
    pub organization:   String,
    pub job_title:      String,
    pub emails:         Vec<String>,
    pub phones:         Vec<String>,
    pub address_street: String,
    pub address_city:   String,
    pub address_state:  String,
    pub address_postal: String,
    pub address_country:String,
}

/// JXA script — __QUERY__ is replaced at runtime.
///
/// Key design choices that prevent hangs:
///   • `app.people.whose(...)` — delegates filtering to Contacts, so we never
///     pull the whole address book across the JXA bridge.
///   • Two separate whose() calls (name + organization) are cheaper than
///     loading everything and filtering in JS.
///   • Every property access is wrapped in try/catch because JXA raises an
///     exception for missing fields rather than returning null/undefined.
///   • Hard cap of 40 results keeps JSON serialisation fast.
const JXA_TEMPLATE: &str = r#"
(function () {
    var app = Application('Contacts');
    var q   = '__QUERY__';
    var seen = {};
    var out  = [];

    function extractPerson(p) {
        var r = {
            name: '', givenName: '', familyName: '', organization: '',
            jobTitle: '', emails: [], phones: [],
            addressStreet: '', addressCity: '', addressState: '',
            addressPostal: '', addressCountry: ''
        };
        try { r.name         = p.name()         || ''; } catch (e) {}
        try { r.givenName    = p.firstName()     || ''; } catch (e) {}
        try { r.familyName   = p.lastName()      || ''; } catch (e) {}
        try { r.organization = p.organization()  || ''; } catch (e) {}
        try { r.jobTitle     = p.jobTitle()      || ''; } catch (e) {}
        try {
            var em = p.emails();
            for (var i = 0; i < em.length; i++) {
                var v = ''; try { v = em[i].value() || ''; } catch (e) {}
                if (v) r.emails.push(v);
            }
        } catch (e) {}
        try {
            var ph = p.phones();
            for (var i = 0; i < ph.length; i++) {
                var v = ''; try { v = ph[i].value() || ''; } catch (e) {}
                if (v) r.phones.push(v);
            }
        } catch (e) {}
        try {
            var ad = p.addresses();
            if (ad.length > 0) {
                try { r.addressStreet  = ad[0].street()  || ''; } catch (e) {}
                try { r.addressCity    = ad[0].city()    || ''; } catch (e) {}
                try { r.addressState   = ad[0].state()   || ''; } catch (e) {}
                try { r.addressPostal  = ad[0].zip()     || ''; } catch (e) {}
                try { r.addressCountry = ad[0].country() || ''; } catch (e) {}
            }
        } catch (e) {}
        return r;
    }

    function addPeople(specifier) {
        try {
            var arr = specifier();
            for (var i = 0; i < arr.length && out.length < 40; i++) {
                var key = '';
                try { key = arr[i].name() || String(i); } catch (e) { key = String(i); }
                if (seen[key]) continue;
                seen[key] = true;
                out.push(extractPerson(arr[i]));
            }
        } catch (e) {}
    }

    // Search by name, then by organisation — Contacts does the filtering
    addPeople(app.people.whose({ name:         { _contains: q } }));
    addPeople(app.people.whose({ organization: { _contains: q } }));

    return JSON.stringify(out);
})();
"#;

fn run_search(query: String) -> Result<Vec<MacContact>, String> {
    let safe_query = query.replace('\'', " ").replace('\\', "");
    let script = JXA_TEMPLATE.replace("__QUERY__", &safe_query);

    let output = std::process::Command::new("osascript")
        .args(["-l", "JavaScript", "-e", &script])
        .output()
        .map_err(|e| format!("Failed to launch osascript: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not authorized") || stderr.contains("1743") {
            return Err(
                "Contacts access was denied. Please grant access in \
                 System Settings → Privacy & Security → Contacts."
                    .to_string(),
            );
        }
        return Err(format!("Contacts search error: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<Vec<MacContact>>(stdout.trim())
        .map_err(|e| format!("Failed to parse contacts response: {e}"))
}

/// Async Tauri command — runs the blocking osascript call on a thread-pool
/// thread so the Tauri IPC / UI thread is never stalled.
#[tauri::command]
async fn search_contacts(query: String) -> Result<Vec<MacContact>, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(vec![]);
    }
    tauri::async_runtime::spawn_blocking(move || run_search(query))
        .await
        .map_err(|e| e.to_string())?
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![search_contacts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
