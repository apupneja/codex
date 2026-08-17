export function PullRequestsPage() {
  return (
    <main className="codex-route-page pull-requests-page">
      <h1 className="pull-requests-page__title">Pull requests</h1>
      <section className="pull-request-skeletons" role="status">
        <span className="pull-request-skeletons__label">
          Checking GitHub access
        </span>
        {Array.from({ length: 5 }, (_, index) => (
          <article className="pull-request-skeleton" key={index}>
            <span className="pull-request-skeleton__icon" />
            <div>
              <div className="pull-request-skeleton__heading">
                <span className="pull-request-skeleton__title" />
                <span className="pull-request-skeleton__status" />
              </div>
              <span className="pull-request-skeleton__meta" />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
