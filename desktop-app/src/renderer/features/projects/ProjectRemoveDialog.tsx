export function ProjectRemoveDialog({
  onClose,
  onConfirm,
  projectName,
}: {
  onClose(): void;
  onConfirm(): void;
  projectName: string;
}) {
  return (
    <div
      className="project-remove-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <form
        aria-labelledby="project-remove-title"
        className="project-remove-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        role="dialog"
      >
        <div className="project-remove-dialog__copy">
          <h2 id="project-remove-title">Remove {projectName}?</h2>
          <p>
            This removes the project from the app. Files on your computer and
            existing chats won&apos;t be deleted.
          </p>
        </div>
        <div className="project-remove-dialog__actions">
          <button onClick={onClose} type="button">
            Cancel
          </button>
          <button className="is-danger" type="submit">
            Remove project
          </button>
        </div>
      </form>
    </div>
  );
}
