interface SidebarProps {
  projects: Array<{ name: string; lineNum: number }>;
  tags: string[];
  hashtags: string[];
  activeFilter: string | null;
  activeHashFilter: string | null;
  activeProjectFilter: string | null;
  onSetProjectFilter: (project: string | null) => void;
  onSetFilter: (tag: string | null) => void;
  onSetHashFilter: (tag: string | null) => void;
}

const SAVED_SEARCHES = [
  { label: 'Today', filter: '@today' },
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
                className={`sidebar-item${activeFilter === filter ? ' sidebar-item--active' : ''}`}
                onClick={() => onSetFilter(activeFilter === filter ? null : filter)}
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
                  className={`sidebar-item sidebar-item--tag${activeFilter === tag ? ' sidebar-item--active' : ''}`}
                  onClick={() => onSetFilter(activeFilter === tag ? null : tag)}
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
                  className={`sidebar-item sidebar-item--hash${activeHashFilter === tag ? ' sidebar-item--active' : ''}`}
                  onClick={() => onSetHashFilter(activeHashFilter === tag ? null : tag)}
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
