import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";

type ChartEmployee = {
  id: string;
  full_name: string;
  manager_id: string | null;
  status: string;
  job_grade_name: string | null;
};

type TreeNode = ChartEmployee & { reports: TreeNode[] };

function buildTree(employees: ChartEmployee[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(employees.map((e) => [e.id, { ...e, reports: [] }]));

  // An employee only ever gets attached under a manager once, tracked here,
  // so a manager_id cycle (or a chain pointing back through one) can't
  // recurse forever or duplicate a node into two places in the tree.
  const attached = new Set<string>();

  for (const node of byId.values()) {
    if (!node.manager_id) continue;
    const manager = byId.get(node.manager_id);
    if (!manager || manager.id === node.id) continue;

    let ancestor: TreeNode | undefined = manager;
    let isCycle = false;
    const seen = new Set<string>([node.id]);
    while (ancestor) {
      if (seen.has(ancestor.id)) {
        isCycle = true;
        break;
      }
      seen.add(ancestor.id);
      ancestor = ancestor.manager_id ? byId.get(ancestor.manager_id) : undefined;
    }
    if (isCycle) continue;

    manager.reports.push(node);
    attached.add(node.id);
  }

  return [...byId.values()].filter((node) => !attached.has(node.id));
}

function OrgChartNode({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div>
      <div
        className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-ink">{node.full_name}</span>
          {node.job_grade_name && <span className="text-[12px] text-ink-soft">{node.job_grade_name}</span>}
        </div>
        <div className="flex items-center gap-2">
          {node.status === "terminated" && <Badge tone="bad">Terminated</Badge>}
          {node.status === "suspended" && <Badge tone="warn">Suspended</Badge>}
          {node.reports.length > 0 && (
            <span className="text-[12px] text-ink-soft">
              {node.reports.length} direct report{node.reports.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      {node.reports
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((report) => (
          <OrgChartNode key={report.id} node={report} depth={depth + 1} />
        ))}
    </div>
  );
}

export default async function OrgChartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const { data: employees } = membership
    ? await supabase
        .from("employees_masked")
        .select("id, full_name, manager_id, status, job_grade_name")
        .eq("org_id", membership.orgId)
        .order("full_name")
    : { data: null };

  const roots = buildTree((employees ?? []) as ChartEmployee[]);
  const rootsSorted = roots.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Org Chart</span>
        <h1 className="text-[22px] font-extrabold text-ink">Reporting hierarchy</h1>
        <p className="text-[13px] text-ink-soft">
          Built from each employee&apos;s Manager field on their edit page. Employees with no manager assigned appear
          as top-level entries.
        </p>
      </header>

      <div className="rounded-card border border-border bg-surface px-3 py-2">
        {rootsSorted.length > 0 ? (
          rootsSorted.map((node) => <OrgChartNode key={node.id} node={node} depth={0} />)
        ) : (
          <div className="px-3 py-10 text-center text-[13px] text-ink-soft">No employees yet.</div>
        )}
      </div>
    </div>
  );
}
