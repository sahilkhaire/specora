import { useState } from "react";
import type { Workspace } from "./workspace-types";

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, description?: string) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreate,
  onDelete,
}: WorkspaceSelectorProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("");
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  function handleCreate() {
    if (!newWorkspaceName.trim()) return;
    
    onCreate(newWorkspaceName.trim(), newWorkspaceDesc.trim() || undefined);
    setNewWorkspaceName("");
    setNewWorkspaceDesc("");
    setShowCreateDialog(false);
  }

  function handleDelete(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    
    if (workspaces.length === 1) {
      alert("Cannot delete the last workspace.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this workspace? All associated environments will be lost.")) {
      onDelete(id);
    }
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
                <button
                  type="button"
                  className="workspace-delete-btn"
                  onClick={(e) => handleDelete(workspace.id, e)}
                  title="Delete workspace"
                >
                  ×
                </button>
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
    </div>
  );
}
