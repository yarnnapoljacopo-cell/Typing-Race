import { useEffect, useMemo, useState } from "react";
import "./MyFiles.css";

interface FolioDoc {
  id: string;
  name: string;
  content: string;
  status: "draft" | "progress" | "done" | "edit";
  updatedAt: number;
}
interface FolioProject {
  id: string;
  name: string;
  open: boolean;
  docs: FolioDoc[];
}
interface FolioState {
  projects: FolioProject[];
}

export interface FolioTarget {
  projectId: string;
  docId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (target: FolioTarget, label: string) => void;
  /** Plain text to save into the chosen chapter. */
  text: string;
  /** Pre-selected target (when re-picking). */
  initialTarget?: FolioTarget | null;
}

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function loadFolio(): FolioState {
  try {
    const raw = localStorage.getItem("folio_v3");
    if (raw) return JSON.parse(raw) as FolioState;
  } catch { /* ignore */ }
  return { projects: [] };
}

export default function FolioSaveDialog({ open, onClose, onSaved, text, initialTarget }: Props) {
  const [state, setState] = useState<FolioState>({ projects: [] });
  const [selProject, setSelProject] = useState<string>("");
  const [selDoc, setSelDoc] = useState<string>(""); // "" = new chapter, "<id>" = existing
  const [newChapterName, setNewChapterName] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loaded = loadFolio();
    setState(loaded);
    if (loaded.projects.length === 0) {
      setCreatingProject(true);
      setNewProjectName("My Writing");
    } else {
      setCreatingProject(false);
      const initialProject = initialTarget
        ? loaded.projects.find((p) => p.id === initialTarget.projectId)?.id
        : undefined;
      const projectId = initialProject ?? loaded.projects[0].id;
      setSelProject(projectId);
      const proj = loaded.projects.find((p) => p.id === projectId);
      setSelDoc(initialTarget?.docId && proj?.docs.some((d) => d.id === initialTarget.docId) ? initialTarget.docId : "");
    }
    setNewChapterName(`Sprint — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
  }, [open, initialTarget]);

  const currentProject = useMemo(
    () => state.projects.find((p) => p.id === selProject) ?? null,
    [state.projects, selProject],
  );

  if (!open) return null;

  const handleSave = () => {
    const next: FolioState = { projects: state.projects.map((p) => ({ ...p, docs: [...p.docs] })) };
    let projectId = selProject;
    let projectName = currentProject?.name ?? "";

    if (creatingProject || next.projects.length === 0) {
      const name = newProjectName.trim() || "Untitled Project";
      projectId = uid();
      projectName = name;
      next.projects.push({ id: projectId, name, open: true, docs: [] });
    }

    const proj = next.projects.find((p) => p.id === projectId);
    if (!proj) return;

    let docId: string;
    let docLabel: string;

    if (selDoc && !creatingProject) {
      // Update existing chapter
      const doc = proj.docs.find((d) => d.id === selDoc);
      if (!doc) return;
      doc.content = text;
      doc.updatedAt = Date.now();
      if (doc.status === "draft") doc.status = "progress";
      docId = doc.id;
      docLabel = doc.name;
    } else {
      // New chapter
      const name = newChapterName.trim() || `Sprint ${new Date().toLocaleString()}`;
      const newDoc: FolioDoc = {
        id: uid(),
        name,
        content: text,
        status: "progress",
        updatedAt: Date.now(),
      };
      proj.docs.push(newDoc);
      docId = newDoc.id;
      docLabel = name;
    }

    try { localStorage.setItem("folio_v3", JSON.stringify(next)); } catch { /* ignore */ }
    onSaved({ projectId, docId }, `${projectName} · ${docLabel}`);
    onClose();
  };

  return (
    <div className="fsv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fsv-card">
        <button className="fsv-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="fsv-title">Save to Folio</h2>
        <p className="fsv-sub">Pick where this writing belongs.</p>

        <div className="fsv-section">
          <div className="fsv-label">Project</div>
          {creatingProject ? (
            <div className="fsv-row">
              <input
                className="fsv-input"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name"
                autoFocus
              />
              {state.projects.length > 0 && (
                <button className="fsv-link" onClick={() => setCreatingProject(false)}>Pick existing</button>
              )}
            </div>
          ) : (
            <div className="fsv-row">
              <select
                className="fsv-input"
                value={selProject}
                onChange={(e) => { setSelProject(e.target.value); setSelDoc(""); }}
              >
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button className="fsv-link" onClick={() => { setCreatingProject(true); setNewProjectName(""); }}>+ New project</button>
            </div>
          )}
        </div>

        {!creatingProject && currentProject && currentProject.docs.length > 0 && (
          <div className="fsv-section">
            <div className="fsv-label">Chapter</div>
            <div className="fsv-doclist">
              <button
                className={`fsv-doc${selDoc === "" ? " active" : ""}`}
                onClick={() => setSelDoc("")}
              >
                <span className="fsv-doc-icon">＋</span>
                <span className="fsv-doc-name">New chapter…</span>
              </button>
              {currentProject.docs.map((d) => (
                <button
                  key={d.id}
                  className={`fsv-doc${selDoc === d.id ? " active" : ""}`}
                  onClick={() => setSelDoc(d.id)}
                  title="Replaces this chapter's content"
                >
                  <span className="fsv-doc-icon">📄</span>
                  <span className="fsv-doc-name">{d.name}</span>
                  <span className="fsv-doc-meta">{d.content.trim() ? `${d.content.trim().split(/\s+/).length} words` : "empty"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(selDoc === "" || creatingProject) && (
          <div className="fsv-section">
            <div className="fsv-label">New Chapter Name</div>
            <input
              className="fsv-input"
              value={newChapterName}
              onChange={(e) => setNewChapterName(e.target.value)}
              placeholder="Chapter title"
            />
          </div>
        )}

        {selDoc !== "" && !creatingProject && (
          <div className="fsv-warn">This will replace the existing chapter content.</div>
        )}

        <div className="fsv-actions">
          <button className="fsv-btn fsv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="fsv-btn fsv-btn--primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
