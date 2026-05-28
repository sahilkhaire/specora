import { useState, type MouseEvent } from "react";
import type { Workspace } from "./workspace-types";

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, description?: string) => void;
  onRename: (id: string, name: string, description?: string) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceSelectorProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameWorkspaceId, setRenameWorkspaceId] = useState("");
  const [renameWorkspaceName, setRenameWorkspaceName] = useState("");
  const [renameWorkspaceDesc, setRenameWorkspaceDesc] = useState("");
  const [renameError, setRenameError] = useState("");

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  function hasDuplicateName(name: string, excludeId?: string): boolean {
    const normalized = name.trim().toLowerCase();
    return workspaces.some((w) => w.id !== excludeId && w.name.trim().toLowerCase() === normalized);
  }

  function handleCreate() {
    const name = newWorkspaceName.trim();
    if (!name) {
      setCreateError("Workspace name is required.");
      return;
    }

    if (hasDuplicateName(name)) {
      setCreateError("Workspace name must be unique.");
      return;
    }
    
    onCreate(name, newWorkspaceDesc.trim() || undefined);
    setNewWorkspaceName("");
    setNewWorkspaceDesc("");
    setCreateError("");
    setShowCreateDialog(false);
  }

  function handleDelete(id: string, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    
    if (workspaces.length === 1) {
      alert("Cannot delete the last workspace.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this workspace? All associated environments will be lost.")) {
      onDelete(id);
    }
  }

  function handleRenameOpen(workspace: Workspace, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setRenameWorkspaceId(workspace.id);
    setRenameWorkspaceName(workspace.name);
    setRenameWorkspaceDesc(workspace.description ?? "");
    setRenameError("");
    setShowRenameDialog(true);
  }

  function handleRenameSave() {
    const name = renameWorkspaceName.trim();
    if (!name) {
      setRenameError("Workspace name is required.");
      return;
    }

    if (hasDuplicateName(name, renameWorkspaceId)) {
      setRenameError("Workspace name must be unique.");
      return;
    }

    onRename(renameWorkspaceId, name, renameWorkspaceDesc.trim() || undefined);
    setShowRenameDialog(false);
    setRenameWorkspaceId("");
    setRenameWorkspaceName("");
    setRenameWorkspaceDesc("");
    setRenameError("");
  }

  return (
    <div className="workspace-selector">
      <div className="workspace-header">
        <button
          type="button"
          className="workspace-toggle"
          onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
        >
          <span className="workspace-icon">📁</span>
          <span className="workspace-name">
            {activeWorkspace?.name || "No Workspace"}
          </span>
          <span className="workspace-arrow">{showWorkspaceMenu ? "▲" : "▼"}</span>
        </button>
        
        <button
          type="button"
          className="workspace-create-btn"
          onClick={() => setShowCreateDialog(true)}
          title="Create new workspace"
        >
          +
        </button>
      </div>

      {showWorkspaceMenu && (
        <div className="workspace-menu">
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className={`workspace-item ${workspace.id === activeWorkspaceId ? "active" : ""}`}
                onClick={() => {
                  onSwitch(workspace.id);
                  setShowWorkspaceMenu(false);
                }}
              >
                <div className="workspace-item-content">
                  <div className="workspace-item-name">{workspace.name}</div>
                  {workspace.description && (
                    <div className="workspace-item-desc">{workspace.description}</div>
                  )}
                </div>
                <div className="workspace-item-actions">
                  <button
                    type="button"
                    className="workspace-rename-btn"
                    onClick={(e) => handleRenameOpen(workspace, e)}
                    title="Rename workspace"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="workspace-delete-btn"
                    onClick={(e) => handleDelete(workspace.id, e)}
                    title="Delete workspace"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Workspace</h2>
            
            <div className="form-field">
              <label htmlFor="workspace-name">Workspace Name *</label>
              <input
                id="workspace-name"
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="My API Project"
                autoFocus
              />
            </div>

            {createError ? <p className="form-error">{createError}</p> : null}

            <div className="form-field">
              <label htmlFor="workspace-desc">Description (optional)</label>
              <textarea
                id="workspace-desc"
                value={newWorkspaceDesc}
                onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                placeholder="Description of this workspace..."
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewWorkspaceName("");
                  setNewWorkspaceDesc("");
                  setCreateError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={!newWorkspaceName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameDialog && (
        <div className="modal-overlay" onClick={() => setShowRenameDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Rename Workspace</h2>

            <div className="form-field">
              <label htmlFor="rename-workspace-name">Workspace Name *</label>
              <input
                id="rename-workspace-name"
                type="text"
                value={renameWorkspaceName}
                onChange={(e) => setRenameWorkspaceName(e.target.value)}
                placeholder="Workspace name"
                autoFocus
              />
            </div>

            {renameError ? <p className="form-error">{renameError}</p> : null}

            <div className="form-field">
              <label htmlFor="rename-workspace-desc">Description (optional)</label>
              <textarea
                id="rename-workspace-desc"
                value={renameWorkspaceDesc}
                onChange={(e) => setRenameWorkspaceDesc(e.target.value)}
                placeholder="Description of this workspace..."
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowRenameDialog(false);
                  setRenameWorkspaceId("");
                  setRenameWorkspaceName("");
                  setRenameWorkspaceDesc("");
                  setRenameError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRenameSave}
                disabled={!renameWorkspaceName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
