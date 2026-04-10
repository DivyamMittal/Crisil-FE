import { Card, SectionTitle } from "@/ui";

export const ManagerWorkspacePage = ({ title }: { title: string }) => (
  <div className="page-stack">
    <SectionTitle title={title} subtitle="Feature-based manager module scaffold ready for CRUD integration." />
    <Card title={title}>
      <div className="placeholder-grid">
        <div className="placeholder-tile">Project / Activity forms</div>
        <div className="placeholder-tile">Team member management</div>
        <div className="placeholder-tile">Filterable tables</div>
        <div className="placeholder-tile">Charts and KPI widgets</div>
      </div>
    </Card>
  </div>
);
