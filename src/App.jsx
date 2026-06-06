import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

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

function App() {
  const [view, setView] = useState("form");
  const [ncrs, setNcrs] = useState([]);
  const [loadingNcrs, setLoadingNcrs] = useState(false);
  const [selectedNcr, setSelectedNcr] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [formData, setFormData] = useState({
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
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedNcr, setSubmittedNcr] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");

  useEffect(() => {
    if (view === "dashboard") {
      loadNcrs();
    }
  }, [view]);

 function printSelectedNcr() {
  window.print();
}

  function toggleIssue(issue) {
    setSelectedIssues((current) =>
      current.includes(issue)
        ? current.filter((item) => item !== issue)
        : [...current, issue]
    );
  }

  function updateField(field, value) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setSelectedArea("");
    setSelectedIssues([]);
    setPhotos([]);
    setFormData({
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
    });
    setSubmittedNcr("");
    setSelectedNcr(null);
    setView("form");
  }

  async function loadNcrs() {
    setLoadingNcrs(true);

    const { data, error } = await supabase
      .from("ncr_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Error loading NCRs.");
      setLoadingNcrs(false);
      return;
    }

    setNcrs(data || []);
    setLoadingNcrs(false);
  }

  async function uploadPhotos(ncrNumber) {
    const uploadedUrls = [];

    for (const photo of photos) {
      const fileExt = photo.name.split(".").pop();
      const fileName = `${ncrNumber}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("ncr-photos")
        .upload(fileName, photo);

      if (uploadError) {
        console.error(uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("ncr-photos")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  
  function startEditing() {
    setEditData({
      department: selectedNcr.department || "",
      job_order_number: selectedNcr.job_order_number || "",
      production_area: selectedNcr.production_area || "",
      qty_affected: selectedNcr.qty_affected || "",
      disposition: selectedNcr.disposition || "",
      assigned_to: selectedNcr.assigned_to || "",
      follow_up_date: selectedNcr.follow_up_date || "",
      qc_verification: selectedNcr.qc_verification || "",
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
    const { error } = await supabase
      .from("ncr_reports")
      .update(editData)
      .eq("id", selectedNcr.id);

    if (error) {
      console.error(error);
      alert("Error saving NCR changes.");
      return;
    }

    const updatedNcr = {
      ...selectedNcr,
      ...editData,
    };

    setSelectedNcr(updatedNcr);

    setNcrs((current) =>
      current.map((ncr) =>
        ncr.id === selectedNcr.id ? updatedNcr : ncr
      )
    );

    setIsEditing(false);
    alert("NCR updated successfully.");
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

    const payload = {
      date_issue_occurred: formData.date_issue_occurred || null,
      department: formData.department,
      job_order_number: formData.job_order_number,
      production_area: formData.production_area,
      shift: "Day",
      qty_affected: formData.qty_affected ? Number(formData.qty_affected) : null,
      issue_area: selectedArea,
      issue_types: selectedIssues,
      description: formData.description,
      action_taken: formData.action_taken,
      disposition: formData.disposition,
      assigned_to: formData.assigned_to,
      follow_up_date: formData.follow_up_date || null,
      qc_verification: formData.qc_verification,
      status: "Open",
    };

    const { data, error } = await supabase
      .from("ncr_reports")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Error submitting NCR. Check console.");
      setSubmitting(false);
      return;
    }

    if (photos.length > 0) {
      try {
        const photoUrls = await uploadPhotos(data.ncr_number);

        const { error: updateError } = await supabase
          .from("ncr_reports")
          .update({ photo_urls: photoUrls })
          .eq("id", data.id);

        if (updateError) {
          console.error(updateError);
          alert("NCR saved, but photo links were not saved.");
        }
      } catch (photoError) {
        console.error(photoError);
        alert("NCR saved, but photo upload failed.");
      }
    }

    setSubmitting(false);
    setSubmittedNcr(data.ncr_number);
  }

  if (submittedNcr) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-xl w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-green-700 mb-2">
            NCR Submitted
          </h1>
          <p className="text-xl font-semibold mb-6">{submittedNcr}</p>
          <p className="text-gray-600 mb-8">
            The report and photos have been saved to Supabase.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetForm}
              className="bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
            >
              Start New NCR
            </button>

            <button
              onClick={() => {
                setSubmittedNcr("");
                setView("dashboard");
              }}
              className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold"
            >
              View Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }



  const filteredNcrs = ncrs.filter((ncr) => {
    const matchesSearch =
      !searchTerm ||
      ncr.ncr_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.issue_area?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || ncr.status === statusFilter;

    const matchesArea =
      areaFilter === "All" || ncr.issue_area === areaFilter;

    return matchesSearch && matchesStatus && matchesArea;
  });


  return (
    <div className="min-h-screen bg-slate-100">
      <style>
        {`
          @media print {
            body { background: white !important; }
            header, .no-print { display: none !important; }
            .print-area {
              display: block !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            img { max-width: 100%; break-inside: avoid; }
          }

          @media screen {
            .print-only { display: none; }
          }

          @media print {
            .print-only { display: block; }
          }
        `}
      </style>
      <header className="bg-slate-950 text-white px-8 py-5 no-print">
        <h1 className="text-2xl font-bold">
          Humphrey Products of Winnipeg Ltd.
        </h1>
        <p className="text-slate-300">Non-Conformance Report System - PRINT FIX LIVE</p>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex gap-4 mb-6 no-print">
          <button
            onClick={() => { setSelectedNcr(null); setView("form"); }}
            className={`px-6 py-3 rounded-xl font-bold ${
              view === "form" ? "bg-blue-700 text-white" : "bg-white border"
            }`}
          >
            Start New NCR
          </button>

          <button
            onClick={() => { setSelectedNcr(null); setView("dashboard"); }}
            className={`px-6 py-3 rounded-xl font-bold ${
              view === "dashboard" ? "bg-blue-700 text-white" : "bg-white border"
            }`}
          >
            View NCR Dashboard
          </button>
        </div>

        {view === "form" && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-1">Start New NCR</h2>
            <p className="text-gray-600 mb-6">
              Complete the form below. NCR number is created automatically.
            </p>

            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">1. Select Area</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.keys(issueOptions).map((area) => (
                  <button
                    key={area}
                    onClick={() => {
                      setSelectedArea(area);
                      setSelectedIssues([]);
                    }}
                    className={`border rounded-xl p-6 text-lg font-bold ${
                      selectedArea === area
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </section>

            {selectedArea && (
              <section className="mb-8">
                <h3 className="text-lg font-bold mb-3">
                  2. What went wrong? — {selectedArea}
                </h3>

                <div className="grid md:grid-cols-2 gap-3">
                  {issueOptions[selectedArea].map((issue) => (
                    <label
                      key={issue}
                      className="border rounded-lg p-3 flex gap-3 items-center"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIssues.includes(issue)}
                        onChange={() => toggleIssue(issue)}
                        className="w-5 h-5"
                      />
                      <span>{issue}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">3. Job Information</h3>

              <div className="grid md:grid-cols-4 gap-4">
                <input
                  type="date"
                  value={formData.date_issue_occurred}
                  onChange={(e) =>
                    updateField("date_issue_occurred", e.target.value)
                  }
                  className="border rounded-lg p-3"
                />

                <input
                  placeholder="Department"
                  value={formData.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  className="border rounded-lg p-3"
                />

                <input
                  placeholder="Job / Order #"
                  value={formData.job_order_number}
                  onChange={(e) =>
                    updateField("job_order_number", e.target.value)
                  }
                  className="border rounded-lg p-3"
                />

                <input
                  placeholder="Qty Affected"
                  type="number"
                  value={formData.qty_affected}
                  onChange={(e) => updateField("qty_affected", e.target.value)}
                  className="border rounded-lg p-3"
                />

                <input
                  placeholder="Production Area"
                  value={formData.production_area}
                  onChange={(e) =>
                    updateField("production_area", e.target.value)
                  }
                  className="border rounded-lg p-3"
                />

                <input
                  value="Day"
                  disabled
                  className="border rounded-lg p-3 bg-gray-100"
                />

                <select
                  value={formData.disposition}
                  onChange={(e) => updateField("disposition", e.target.value)}
                  className="border rounded-lg p-3"
                >
                  <option value="">Disposition</option>
                  <option value="Rework">Rework</option>
                  <option value="Scrap">Scrap</option>
                  <option value="Use As Is">Use As Is</option>
                </select>

                <select
                  value={formData.qc_verification}
                  onChange={(e) =>
                    updateField("qc_verification", e.target.value)
                  }
                  className="border rounded-lg p-3"
                >
                  <option value="">QC Verification</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="More Work Required">More Work Required</option>
                </select>
              </div>
            </section>

            <section className="mb-8 grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-bold mb-3">4. Description</h3>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the issue..."
                  className="border rounded-lg p-3 w-full h-36"
                />
              </div>

              <div>
                <h3 className="text-lg font-bold mb-3">5. Action Taken</h3>
                <textarea
                  value={formData.action_taken}
                  onChange={(e) => updateField("action_taken", e.target.value)}
                  placeholder="Describe action taken..."
                  className="border rounded-lg p-3 w-full h-36"
                />
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">6. Follow-Up</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <select
                  value={formData.assigned_to}
                  onChange={(e) => updateField("assigned_to", e.target.value)}
                  className="border rounded-lg p-3"
                >
                  <option value="">Assigned To</option>
                  <option value="Matthew">Matthew</option>
                  <option value="Mark">Mark</option>
                  <option value="Luke">Luke</option>
                  <option value="John">John</option>
                  <option value="Evan">Evan</option>
                </select>

                <input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => updateField("follow_up_date", e.target.value)}
                  className="border rounded-lg p-3"
                />
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">7. Photos</h3>

              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.heic,.heif,.webp"
                onChange={(e) =>
                  setPhotos((current) => [
                    ...current,
                    ...Array.from(e.target.files || []),
                  ])
                }
                className="border rounded-lg p-3 w-full"
              />

              {photos.length > 0 && (
                <div className="text-sm text-gray-600 mt-2">
                  <p>
                    {photos.length} photo(s) selected. You can add more photos without replacing the selected ones.
                  </p>
                  <ul className="list-disc ml-5 mt-2">
                    {photos.map((photo, index) => (
                      <li key={`${photo.name}-${index}`}>{photo.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <button
              onClick={submitNcr}
              disabled={submitting}
              className="w-full bg-green-700 text-white py-4 rounded-xl text-xl font-bold hover:bg-green-800 disabled:bg-gray-400"
            >
              {submitting ? "Submitting..." : "Submit NCR"}
            </button>
          </div>
        )}

        {view === "dashboard" && !selectedNcr && (
          <div className="bg-white rounded-2xl shadow-lg p-6 overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">NCR Dashboard</h2>

              <button
                onClick={loadNcrs}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg"
              >
                Refresh
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <input
                type="text"
                placeholder="Search NCR #, department, assigned to..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border rounded-lg p-3"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg p-3"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Review">In Review</option>
                <option value="Closed">Closed</option>
              </select>

              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="border rounded-lg p-3"
              >
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
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-3 border">NCR #</th>
                    <th className="p-3 border">Area</th>
                    <th className="p-3 border">Department</th>
                    <th className="p-3 border">Disposition</th>
                    <th className="p-3 border">Assigned To</th>
                    <th className="p-3 border">Status</th>
                    <th className="p-3 border">Photos</th>
                    <th className="p-3 border">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredNcrs.map((ncr) => (
                    <tr
                      key={ncr.id}
                      onClick={() => setSelectedNcr(ncr)}
                      className="hover:bg-blue-50 cursor-pointer"
                    >
                      <td className="p-3 border font-bold">{ncr.ncr_number}</td>
                      <td className="p-3 border">{ncr.issue_area}</td>
                      <td className="p-3 border">{ncr.department}</td>
                      <td className="p-3 border">{ncr.disposition}</td>
                      <td className="p-3 border">{ncr.assigned_to}</td>
                      <td className="p-3 border">{ncr.status}</td>
                      <td className="p-3 border">{ncr.photo_urls?.length || 0}</td>
                      <td className="p-3 border">
                        {ncr.created_at
                          ? new Date(ncr.created_at).toLocaleDateString()
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "dashboard" && selectedNcr && (
         <div id="printable-ncr" className="bg-white rounded-2xl shadow-lg p-6 print-area">
            <div className="print-only text-center mb-6">
              <h1 className="text-2xl font-bold">HUMPHREY PRODUCTS OF WINNIPEG LTD.</h1>
              <h2 className="text-xl font-bold">NON-CONFORMANCE REPORT</h2>
              <p>Windows • Doors • Sealed Units Production</p>
              <p className="mt-3 text-sm">
                All NCRs must be completed clearly and submitted the same day the issue is reported.
              </p>
              <hr className="my-4" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold">{selectedNcr.ncr_number}</h2>
                <p className="text-gray-600">
                  {selectedNcr.issue_area} • {selectedNcr.status}
                </p>
              </div>

              <div className="flex gap-3 no-print">
              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="bg-blue-700 text-white px-5 py-3 rounded-lg font-bold"
                >
                  Edit NCR
                </button>
              )}

              {isEditing && (
                <>
                  <button
                    onClick={saveNcrChanges}
                    className="bg-green-700 text-white px-5 py-3 rounded-lg font-bold"
                  >
                    Save Changes
                  </button>

                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-500 text-white px-5 py-3 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                </>
              )}

              <button
                onClick={printSelectedNcr}
                className="bg-purple-700 text-white px-5 py-3 rounded-lg font-bold"
              >
                Print NCR
              </button>

              <button
                onClick={() => {
                  setSelectedNcr(null);
                  setIsEditing(false);
                }}
                className="bg-slate-800 text-white px-5 py-3 rounded-lg font-bold"
              >
                Back to Dashboard
              </button>
            </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Department</p><p className="font-semibold">{selectedNcr.department || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Job / Order #</p><p className="font-semibold">{selectedNcr.job_order_number || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Production Area</p><p className="font-semibold">{selectedNcr.production_area || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Qty Affected</p><p className="font-semibold">{selectedNcr.qty_affected || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Disposition</p><p className="font-semibold">{selectedNcr.disposition || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Assigned To</p><p className="font-semibold">{selectedNcr.assigned_to || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">Follow-Up Date</p><p className="font-semibold">{selectedNcr.follow_up_date || "—"}</p></div>
              <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs uppercase text-slate-500 font-bold">QC Verification</p><p className="font-semibold">{selectedNcr.qc_verification || "—"}</p></div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              
            {isEditing && (
              <div className="border rounded-xl p-5 mb-6 bg-blue-50">
                <h3 className="font-bold text-xl mb-4">Edit NCR</h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    value={editData.department || ""}
                    onChange={(e) => updateEditField("department", e.target.value)}
                    placeholder="Department"
                    className="border rounded-lg p-3"
                  />

                  <input
                    value={editData.job_order_number || ""}
                    onChange={(e) => updateEditField("job_order_number", e.target.value)}
                    placeholder="Job / Order #"
                    className="border rounded-lg p-3"
                  />

                  <input
                    value={editData.production_area || ""}
                    onChange={(e) => updateEditField("production_area", e.target.value)}
                    placeholder="Production Area"
                    className="border rounded-lg p-3"
                  />

                  <input
                    type="number"
                    value={editData.qty_affected || ""}
                    onChange={(e) => updateEditField("qty_affected", e.target.value)}
                    placeholder="Qty Affected"
                    className="border rounded-lg p-3"
                  />

                  <select
                    value={editData.disposition || ""}
                    onChange={(e) => updateEditField("disposition", e.target.value)}
                    className="border rounded-lg p-3"
                  >
                    <option value="">Disposition</option>
                    <option value="Rework">Rework</option>
                    <option value="Scrap">Scrap</option>
                    <option value="Use As Is">Use As Is</option>
                  </select>

                  <select
                    value={editData.assigned_to || ""}
                    onChange={(e) => updateEditField("assigned_to", e.target.value)}
                    className="border rounded-lg p-3"
                  >
                    <option value="">Assigned To</option>
                    <option value="Matthew">Matthew</option>
                    <option value="Mark">Mark</option>
                    <option value="Luke">Luke</option>
                    <option value="John">John</option>
                    <option value="Evan">Evan</option>
                  </select>

                  <input
                    type="date"
                    value={editData.follow_up_date || ""}
                    onChange={(e) => updateEditField("follow_up_date", e.target.value)}
                    className="border rounded-lg p-3"
                  />

                  <select
                    value={editData.qc_verification || ""}
                    onChange={(e) => updateEditField("qc_verification", e.target.value)}
                    className="border rounded-lg p-3"
                  >
                    <option value="">QC Verification</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="More Work Required">More Work Required</option>
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <textarea
                    value={editData.description || ""}
                    onChange={(e) => updateEditField("description", e.target.value)}
                    placeholder="Description"
                    className="border rounded-lg p-3 h-32"
                  />

                  <textarea
                    value={editData.action_taken || ""}
                    onChange={(e) => updateEditField("action_taken", e.target.value)}
                    placeholder="Action Taken"
                    className="border rounded-lg p-3 h-32"
                  />
                </div>
              </div>
            )}

<div className="border rounded-xl p-5">
                <h3 className="font-bold text-lg mb-3">Issues Selected</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedNcr.issue_types?.map((issue) => (
                    <span key={issue} className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full text-sm font-semibold">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border rounded-xl p-5">
                <h3 className="font-bold text-lg mb-3">Dates</h3>
                <p><strong>Reported:</strong> {selectedNcr.date_reported || "—"}</p>
                <p><strong>Issue Occurred:</strong> {selectedNcr.date_issue_occurred || "—"}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="border rounded-xl p-5">
                <h3 className="font-bold text-lg mb-3">Description</h3>
                <p className="whitespace-pre-wrap">{selectedNcr.description || "—"}</p>
              </div>

              <div className="border rounded-xl p-5">
                <h3 className="font-bold text-lg mb-3">Action Taken</h3>
                <p className="whitespace-pre-wrap">{selectedNcr.action_taken || "—"}</p>
              </div>
            </div>

            <div className="border rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4">Photos</h3>
              {selectedNcr.photo_urls?.length > 0 ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {selectedNcr.photo_urls.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block border rounded-xl overflow-hidden hover:shadow-lg">
                      <img src={url} alt={`NCR photo ${index + 1}`} className="w-full h-48 object-cover" />
                      <div className="p-3 font-semibold text-sm">View Photo {index + 1}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No photos uploaded.</p>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
