import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TABLE_NAME = "ncr_reports";
const PHOTO_BUCKET = "ncr-photos";

const issueOptions = {
  Windows: [
    "Incorrect size",
    "Out of square",
    "Poor weld/corner",
    "Wrong finish",
    "Glazing stop issue",
    "Screen issue",
    "Lock/handle issue",
    "Surface damage",
    "Wrong material",
    "Other",
  ],
  Doors: [
    "Incorrect size",
    "Out of square",
    "Panel warped",
    "Hardware issue",
    "Threshold issue",
    "Weatherstrip issue",
    "Door operation issue",
    "Surface damage",
    "Wrong material",
    "Other",
  ],
  "Sealed Units": [
    "Wrong glass type",
    "Wrong Low-E",
    "Scratched glass",
    "Dirty glass/debris",
    "Spacer issue",
    "Butyl uneven/skip",
    "Butyl contamination",
    "Sealant void",
    "Argon issue",
    "Other",
  ],
  Shipping: [
    "Handling damage",
    "Incorrect staging",
    "Incorrect labeling",
    "Missing parts",
    "Packaging damage",
    "Product not protected",
    "Other",
  ],
};

const emptyForm = {
  date_issue_occurred: "",
  department: "",
  job_order_number: "",
  production_area: "",
  qty_affected: "",
  description: "",
  action_taken: "",
  disposition: "",
  assigned_to: "",
  follow_up_date: "",
  qc_verification: "",
};

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function App() {
  const [view, setView] = useState("form");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNcr, setSubmittedNcr] = useState(null);
  const [ncrs, setNcrs] = useState([]);
  const [loadingNcrs, setLoadingNcrs] = useState(false);
  const [selectedNcr, setSelectedNcr] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    if (view === "dashboard") {
      loadNcrs();
    }
  }, [view]);

  const filteredNcrs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return ncrs.filter((ncr) => {
      const matchesSearch =
        !search ||
        ncr.ncr_number?.toLowerCase().includes(search) ||
        ncr.department?.toLowerCase().includes(search) ||
        ncr.assigned_to?.toLowerCase().includes(search) ||
        ncr.issue_area?.toLowerCase().includes(search) ||
        ncr.job_order_number?.toLowerCase().includes(search);

      const matchesStatus = statusFilter === "All" || ncr.status === statusFilter;
      const matchesArea = areaFilter === "All" || ncr.issue_area === areaFilter;

      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [ncrs, searchTerm, statusFilter, areaFilter]);

  function printSelectedNcr() {
    window.print();
  }

  function showError(message, error) {
    console.error(message, error);
    const detail = error?.message || error?.error_description || JSON.stringify(error, null, 2);
    setLastError(`${message}\n\n${detail}`);
    alert(`${message}. Check details on screen or console.`);
  }

  function updateField(field, value) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleIssue(issue) {
    setSelectedIssues((current) =>
      current.includes(issue)
        ? current.filter((item) => item !== issue)
        : [...current, issue]
    );
  }

  function resetForm() {
    setSelectedArea("");
    setSelectedIssues([]);
    setPhotos([]);
    setFormData(emptyForm);
    setSubmittedNcr(null);
    setSelectedNcr(null);
    setIsEditing(false);
    setEditData({});
    setLastError("");
    setView("form");
  }

  async function loadNcrs() {
    setLoadingNcrs(true);
    setLastError("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      showError("Error loading NCRs", error);
      setLoadingNcrs(false);
      return;
    }

    setNcrs(data || []);
    setLoadingNcrs(false);
  }

  async function uploadPhotos(ncrNumber) {
    const uploadedUrls = [];

    for (const photo of photos) {
      const extension = photo.name.includes(".") ? photo.name.split(".").pop() : "jpg";
      const cleanNcrNumber = ncrNumber || `ncr-${Date.now()}`;
      const fileName = `${cleanNcrNumber}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(fileName, photo, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function submitNcr() {
    if (!selectedArea) {
      alert("Please select an area.");
      return;
    }

    if (selectedIssues.length === 0) {
      alert("Please select at least one issue.");
      return;
    }

    setSubmitting(true);
    setLastError("");

    const payload = {
      date_issue_occurred: formData.date_issue_occurred || null,
      department: formData.department.trim(),
      job_order_number: formData.job_order_number.trim(),
      production_area: formData.production_area.trim(),
      shift: "Day",
      qty_affected: formData.qty_affected ? Number(formData.qty_affected) : null,
      issue_area: selectedArea,
      issue_types: selectedIssues,
      description: formData.description.trim(),
      action_taken: formData.action_taken.trim(),
      disposition: formData.disposition,
      assigned_to: formData.assigned_to,
      follow_up_date: formData.follow_up_date || null,
      qc_verification: formData.qc_verification,
      status: "Open",
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select()
      .single();

    if (error) {
      showError("Error submitting NCR", error);
      setSubmitting(false);
      return;
    }

    let finalNcr = data;

    if (photos.length > 0) {
      try {
        const photoUrls = await uploadPhotos(data.ncr_number);

        const { data: updatedData, error: updateError } = await supabase
          .from(TABLE_NAME)
          .update({ photo_urls: photoUrls })
          .eq("id", data.id)
          .select()
          .single();

        if (updateError) {
          showError("NCR saved, but photo links were not saved", updateError);
        } else {
          finalNcr = updatedData;
        }
      } catch (photoError) {
        showError("NCR saved, but photo upload failed", photoError);
      }
    }

    setSubmitting(false);
    setSubmittedNcr(finalNcr);
  }

  function openDashboard() {
    setView("dashboard");
    setSelectedNcr(null);
    setIsEditing(false);
    setEditData({});
    setSubmittedNcr(null);
    setLastError("");
  }

  function openForm() {
    setView("form");
    setSelectedNcr(null);
    setIsEditing(false);
    setEditData({});
    setSubmittedNcr(null);
    setLastError("");
  }

  function startEditing() {
    if (!selectedNcr) return;

    setEditData({
      department: selectedNcr.department || "",
      job_order_number: selectedNcr.job_order_number || "",
      production_area: selectedNcr.production_area || "",
      qty_affected: selectedNcr.qty_affected ?? "",
      disposition: selectedNcr.disposition || "",
      assigned_to: selectedNcr.assigned_to || "",
      follow_up_date: formatDate(selectedNcr.follow_up_date) === "—" ? "" : formatDate(selectedNcr.follow_up_date),
      qc_verification: selectedNcr.qc_verification || "",
      status: selectedNcr.status || "Open",
      description: selectedNcr.description || "",
      action_taken: selectedNcr.action_taken || "",
    });

    setIsEditing(true);
  }

  function updateEditField(field, value) {
    setEditData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveNcrChanges() {
    if (!selectedNcr?.id) return;

    const payload = {
      ...editData,
      qty_affected: editData.qty_affected === "" ? null : Number(editData.qty_affected),
      follow_up_date: editData.follow_up_date || null,
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", selectedNcr.id)
      .select()
      .single();

    if (error) {
      showError("Error saving NCR changes", error);
      return;
    }

    setSelectedNcr(data);
    setNcrs((current) => current.map((ncr) => (ncr.id === data.id ? data : ncr)));
    setIsEditing(false);
    alert("NCR updated successfully.");
  }

  if (submittedNcr) {
    return (
      <div className="app-main">
        <div className="card success-card">
          <div className="success-icon">✅</div>
          <h1>NCR Submitted</h1>
          <h2>{submittedNcr.ncr_number}</h2>
          <p>The report has been saved to Supabase.</p>

          {lastError && <div className="error-box">{lastError}</div>}

          <div className="nav-buttons" style={{ justifyContent: "center" }}>
            <button className="btn primary" onClick={resetForm}>
              Start New NCR
            </button>
            <button className="btn dark" onClick={openDashboard}>
              View Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="app-header no-print">
        <h1>Humphrey Products of Winnipeg Ltd.</h1>
        <p>Non-Conformance Report System</p>
      </header>

      <main className="app-main">
        <div className="nav-buttons no-print">
          <button className={view === "form" ? "btn primary" : "btn"} onClick={openForm}>
            Start New NCR
          </button>
          <button className={view === "dashboard" ? "btn primary" : "btn"} onClick={openDashboard}>
            View NCR Dashboard
          </button>
        </div>

        {lastError && <div className="error-box no-print">{lastError}</div>}

        {view === "form" && (
          <div className="card">
            <h2 className="card-title">Start New NCR</h2>
            <p className="card-subtitle">Complete the form below. NCR number is created automatically.</p>

            <section className="section">
              <h3>1. Select Area</h3>
              <div className="area-grid">
                {Object.keys(issueOptions).map((area) => (
                  <button
                    key={area}
                    type="button"
                    className={selectedArea === area ? "area-button selected" : "area-button"}
                    onClick={() => {
                      setSelectedArea(area);
                      setSelectedIssues([]);
                    }}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </section>

            {selectedArea && (
              <section className="section">
                <h3>2. What went wrong? — {selectedArea}</h3>
                <div className="issue-grid">
                  {issueOptions[selectedArea].map((issue) => (
                    <label key={issue} className="issue-label">
                      <input
                        type="checkbox"
                        checked={selectedIssues.includes(issue)}
                        onChange={() => toggleIssue(issue)}
                      />
                      <span>{issue}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <section className="section">
              <h3>3. Job Information</h3>
              <div className="form-grid">
                <input
                  className="field"
                  type="date"
                  value={formData.date_issue_occurred}
                  onChange={(event) => updateField("date_issue_occurred", event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Department"
                  value={formData.department}
                  onChange={(event) => updateField("department", event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Job / Order #"
                  value={formData.job_order_number}
                  onChange={(event) => updateField("job_order_number", event.target.value)}
                />
                <input
                  className="field"
                  type="number"
                  placeholder="Qty Affected"
                  value={formData.qty_affected}
                  onChange={(event) => updateField("qty_affected", event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Production Area"
                  value={formData.production_area}
                  onChange={(event) => updateField("production_area", event.target.value)}
                />
                <input className="field" value="Day" disabled />
                <select
                  className="field"
                  value={formData.disposition}
                  onChange={(event) => updateField("disposition", event.target.value)}
                >
                  <option value="">Disposition</option>
                  <option value="Rework">Rework</option>
                  <option value="Scrap">Scrap</option>
                  <option value="Use As Is">Use As Is</option>
                </select>
                <select
                  className="field"
                  value={formData.qc_verification}
                  onChange={(event) => updateField("qc_verification", event.target.value)}
                >
                  <option value="">QC Verification</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="More Work Required">More Work Required</option>
                </select>
              </div>
            </section>

            <section className="section two-grid">
              <div>
                <h3>4. Description</h3>
                <textarea
                  className="field"
                  placeholder="Describe the issue..."
                  value={formData.description}
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </div>
              <div>
                <h3>5. Action Taken</h3>
                <textarea
                  className="field"
                  placeholder="Describe action taken..."
                  value={formData.action_taken}
                  onChange={(event) => updateField("action_taken", event.target.value)}
                />
              </div>
            </section>

            <section className="section">
              <h3>6. Follow-Up</h3>
              <div className="two-grid">
                <select
                  className="field"
                  value={formData.assigned_to}
                  onChange={(event) => updateField("assigned_to", event.target.value)}
                >
                  <option value="">Assigned To</option>
                  <option value="Matthew">Matthew</option>
                  <option value="Mark">Mark</option>
                  <option value="Luke">Luke</option>
                  <option value="John">John</option>
                  <option value="Evan">Evan</option>
                </select>
                <input
                  className="field"
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(event) => updateField("follow_up_date", event.target.value)}
                />
              </div>
            </section>

            <section className="section">
              <h3>7. Photos</h3>
              <input
                className="field"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.heic,.heif,.webp"
                onChange={(event) =>
                  setPhotos((current) => [...current, ...Array.from(event.target.files || [])])
                }
              />

              {photos.length > 0 && (
                <div className="help-text">
                  <p>{photos.length} photo(s) selected.</p>
                  <ul>
                    {photos.map((photo, index) => (
                      <li key={`${photo.name}-${index}`}>{photo.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className="submit-row">
              <button
                className="btn green full-width"
                type="button"
                disabled={submitting}
                onClick={submitNcr}
              >
                {submitting ? "Submitting..." : "Submit NCR"}
              </button>
            </div>
          </div>
        )}

        {view === "dashboard" && !selectedNcr && (
          <div className="card">
            <div className="ncr-detail-header">
              <div>
                <h2 className="card-title">NCR Dashboard</h2>
                <p className="card-subtitle">Click any row to open a full NCR.</p>
              </div>
              <button className="btn dark no-print" type="button" onClick={loadNcrs}>
                Refresh
              </button>
            </div>

            <div className="dashboard-tools no-print">
              <input
                className="field"
                placeholder="Search NCR #, department, assigned to, job #..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Review">In Review</option>
                <option value="Closed">Closed</option>
              </select>
              <select className="field" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                <option value="All">All Areas</option>
                <option value="Windows">Windows</option>
                <option value="Doors">Doors</option>
                <option value="Sealed Units">Sealed Units</option>
                <option value="Shipping">Shipping</option>
              </select>
            </div>

            {loadingNcrs ? (
              <p>Loading NCRs...</p>
            ) : (
              <div className="table-wrap">
                <table className="ncr-table">
                  <thead>
                    <tr>
                      <th>NCR #</th>
                      <th>Area</th>
                      <th>Department</th>
                      <th>Disposition</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th>Photos</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNcrs.map((ncr) => (
                      <tr
                        key={ncr.id}
                        onClick={() => {
                          setSelectedNcr(ncr);
                          setIsEditing(false);
                        }}
                      >
                        <td><strong>{ncr.ncr_number || "—"}</strong></td>
                        <td>{ncr.issue_area || "—"}</td>
                        <td>{ncr.department || "—"}</td>
                        <td>{ncr.disposition || "—"}</td>
                        <td>{ncr.assigned_to || "—"}</td>
                        <td>{ncr.status || "—"}</td>
                        <td>{normalizeArray(ncr.photo_urls).length}</td>
                        <td>{formatDate(ncr.created_at)}</td>
                      </tr>
                    ))}
                    {filteredNcrs.length === 0 && (
                      <tr>
                        <td colSpan="8">No NCRs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "dashboard" && selectedNcr && (
          <div className="card ncr-detail">
            <div className="ncr-detail-header">
              <div>
                <h2 className="ncr-number">{selectedNcr.ncr_number || "NCR"}</h2>
                <p className="ncr-meta">
                  {selectedNcr.issue_area || "—"} • {selectedNcr.status || "—"}
                </p>
              </div>

              <div className="ncr-actions no-print">
                {!isEditing && (
                  <button className="btn primary" type="button" onClick={startEditing}>
                    Edit NCR
                  </button>
                )}
                <button className="btn purple" type="button" onClick={printSelectedNcr}>
                  Print NCR
                </button>
                <button
                  className="btn dark"
                  type="button"
                  onClick={() => {
                    setSelectedNcr(null);
                    setIsEditing(false);
                    setEditData({});
                  }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="edit-box no-print">
                <h3>Edit NCR</h3>
                <div className="form-grid">
                  <input
                    className="field"
                    value={editData.department || ""}
                    onChange={(event) => updateEditField("department", event.target.value)}
                    placeholder="Department"
                  />
                  <input
                    className="field"
                    value={editData.job_order_number || ""}
                    onChange={(event) => updateEditField("job_order_number", event.target.value)}
                    placeholder="Job / Order #"
                  />
                  <input
                    className="field"
                    value={editData.production_area || ""}
                    onChange={(event) => updateEditField("production_area", event.target.value)}
                    placeholder="Production Area"
                  />
                  <input
                    className="field"
                    type="number"
                    value={editData.qty_affected || ""}
                    onChange={(event) => updateEditField("qty_affected", event.target.value)}
                    placeholder="Qty Affected"
                  />
                  <select
                    className="field"
                    value={editData.disposition || ""}
                    onChange={(event) => updateEditField("disposition", event.target.value)}
                  >
                    <option value="">Disposition</option>
                    <option value="Rework">Rework</option>
                    <option value="Scrap">Scrap</option>
                    <option value="Use As Is">Use As Is</option>
                  </select>
                  <select
                    className="field"
                    value={editData.assigned_to || ""}
                    onChange={(event) => updateEditField("assigned_to", event.target.value)}
                  >
                    <option value="">Assigned To</option>
                    <option value="Matthew">Matthew</option>
                    <option value="Mark">Mark</option>
                    <option value="Luke">Luke</option>
                    <option value="John">John</option>
                    <option value="Evan">Evan</option>
                  </select>
                  <input
                    className="field"
                    type="date"
                    value={editData.follow_up_date || ""}
                    onChange={(event) => updateEditField("follow_up_date", event.target.value)}
                  />
                  <select
                    className="field"
                    value={editData.qc_verification || ""}
                    onChange={(event) => updateEditField("qc_verification", event.target.value)}
                  >
                    <option value="">QC Verification</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="More Work Required">More Work Required</option>
                  </select>
                  <select
                    className="field"
                    value={editData.status || "Open"}
                    onChange={(event) => updateEditField("status", event.target.value)}
                  >
                    <option value="Open">Open</option>
                    <option value="In Review">In Review</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="two-grid" style={{ marginTop: 14 }}>
                  <textarea
                    className="field"
                    value={editData.description || ""}
                    onChange={(event) => updateEditField("description", event.target.value)}
                    placeholder="Description"
                  />
                  <textarea
                    className="field"
                    value={editData.action_taken || ""}
                    onChange={(event) => updateEditField("action_taken", event.target.value)}
                    placeholder="Action Taken"
                  />
                </div>

                <div className="nav-buttons" style={{ marginTop: 14, marginBottom: 0 }}>
                  <button className="btn green" type="button" onClick={saveNcrChanges}>
                    Save Changes
                  </button>
                  <button className="btn" type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="info-grid">
              <InfoBox label="Department" value={selectedNcr.department} />
              <InfoBox label="Job / Order #" value={selectedNcr.job_order_number} />
              <InfoBox label="Production Area" value={selectedNcr.production_area} />
              <InfoBox label="Qty Affected" value={selectedNcr.qty_affected} />
              <InfoBox label="Disposition" value={selectedNcr.disposition} />
              <InfoBox label="Assigned To" value={selectedNcr.assigned_to} />
              <InfoBox label="Follow-Up Date" value={formatDate(selectedNcr.follow_up_date)} />
              <InfoBox label="QC Verification" value={selectedNcr.qc_verification} />
            </div>

            <div className="two-grid section">
              <div className="panel">
                <h3>Issues Selected</h3>
                <div className="badges">
                  {normalizeArray(selectedNcr.issue_types).length > 0 ? (
                    normalizeArray(selectedNcr.issue_types).map((issue) => (
                      <span key={issue} className="badge">
                        {issue}
                      </span>
                    ))
                  ) : (
                    <p>—</p>
                  )}
                </div>
              </div>

              <div className="panel">
                <h3>Dates</h3>
                <p><strong>Reported:</strong> {formatDate(selectedNcr.date_reported)}</p>
                <p><strong>Issue Occurred:</strong> {formatDate(selectedNcr.date_issue_occurred)}</p>
              </div>
            </div>

            <div className="two-grid section">
              <div className="panel">
                <h3>Description</h3>
                <p>{selectedNcr.description || "—"}</p>
              </div>
              <div className="panel">
                <h3>Action Taken</h3>
                <p>{selectedNcr.action_taken || "—"}</p>
              </div>
            </div>

            <div className="panel section">
              <h3>Photos</h3>
              {normalizeArray(selectedNcr.photo_urls).length > 0 ? (
                <div className="photo-grid">
                  {normalizeArray(selectedNcr.photo_urls).map((url, index) => (
                    <a key={url} className="photo-card" href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`NCR photo ${index + 1}`} />
                      <div>View Photo {index + 1}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="small-note">No photos uploaded.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="info-box">
      <div className="info-label">{label}</div>
      <div className="info-value">{value || value === 0 ? value : "—"}</div>
    </div>
  );
}

export default App;
