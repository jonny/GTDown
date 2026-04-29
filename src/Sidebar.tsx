interface SidebarProps {
  projects: Array<{ name: string; lineNum: number }>;
  tags: string[];
  hashtags: string[];
  activeFilter: string[];
  activeHashFilter: string[];
  activeProjectFilter: string | null;
  onSetProjectFilter: (project: string | null) => void;
  onSetFilter: (tag: string) => void;
  onSetHashFilter: (tag: string) => void;
}

const SAVED_SEARCHES = [
  { label: 'Now', filter: '@now' },
  { label: 'Not Done', filter: '!@done' },
  { label: 'Done', filter: '@done' },
];

export function Sidebar({ projects, tags, hashtags, activeFilter, activeHashFilter, activeProjectFilter, onSetProjectFilter, onSetFilter, onSetHashFilter }: SidebarProps) {
  return (
    <aside className="sidebar">
      <section className="sidebar-section">
        <h3 className="sidebar-heading">Projects</h3>
        {projects.length === 0 ? (
          <p className="sidebar-empty">No projects yet</p>
        ) : (
          <ul className="sidebar-list">
            {projects.map((p) => (
              <li key={p.lineNum}>
                <button
                  className={`sidebar-item${activeProjectFilter === p.name ? ' sidebar-item--active' : ''}`}
                  onClick={() => onSetProjectFilter(activeProjectFilter === p.name ? null : p.name)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sidebar-section">
        <h3 className="sidebar-heading">Searches</h3>
        <ul className="sidebar-list">
          {SAVED_SEARCHES.map(({ label, filter }) => (
            <li key={filter}>
              <button
                className={`sidebar-item${activeFilter.includes(filter) ? ' sidebar-item--active' : ''}`}
                onClick={() => onSetFilter(filter)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {tags.length > 0 && (
        <section className="sidebar-section">
          <h3 className="sidebar-heading">Tags</h3>
          <ul className="sidebar-list">
            {tags.map((tag) => (
              <li key={tag}>
                <button
                  className={`sidebar-item sidebar-item--tag${activeFilter.includes(tag) ? ' sidebar-item--active' : ''}`}
                  onClick={() => onSetFilter(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hashtags.length > 0 && (
        <section className="sidebar-section">
          <h3 className="sidebar-heading">Labels</h3>
          <ul className="sidebar-list">
            {hashtags.map((tag) => (
              <li key={tag}>
                <button
                  className={`sidebar-item sidebar-item--hash${activeHashFilter.includes(tag) ? ' sidebar-item--active' : ''}`}
                  onClick={() => onSetHashFilter(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
