export type ApplicationRole = "CONSUMER" | "ADMIN" | "MARKETING";
export type ServiceDisposition = "CANONICAL" | "REVIEW_REQUIRED";

export interface RenderServiceContract {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly role: ApplicationRole;
  readonly disposition: ServiceDisposition;
  readonly publicUrl: string;
  readonly rootDirectory: string;
  readonly buildCommand: string;
  readonly startCommand: string;
  readonly nodeVersion: string;
  readonly autoDeploy: boolean;
  readonly healthPath: string | null;
  readonly owner: string;
  readonly notes: string;
}

export interface RenderServiceObservation {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly publicUrl: string;
  readonly rootDirectory: string;
  readonly buildCommand: string;
  readonly startCommand: string;
  readonly nodeVersion: string;
  readonly autoDeploy: boolean;
  readonly liveCommit: string | null;
  readonly latestDeployStatus: string;
}

export interface ServiceTopologyAssessment {
  readonly decision: "ALIGNED" | "BLOCKED";
  readonly canonicalRoles: Readonly<Record<ApplicationRole, string>>;
  readonly alignedServiceIds: readonly string[];
  readonly blockers: readonly string[];
  readonly deletionAuthorised: false;
}

const pnpmBuild = "corepack enable && CI=true pnpm install --frozen-lockfile && pnpm build";

export const renderServiceTopology: readonly RenderServiceContract[] = [
  { serviceId: "srv-d9hltsfaqgkc73al7lig", serviceName: "fuel-cap-1", role: "CONSUMER", disposition: "CANONICAL", publicUrl: "https://fuel-cap-1.onrender.com", rootDirectory: "", buildCommand: pnpmBuild, startCommand: "pnpm start", nodeVersion: "22.22.0", autoDeploy: true, healthPath: "/api/health", owner: "Consumer Product", notes: "Canonical consumer prototype; Supabase authentication redirect target." },
  { serviceId: "srv-da49ao2fngtc7388cec0", serviceName: "fuelcap-app", role: "ADMIN", disposition: "CANONICAL", publicUrl: "https://fuelcap-app.onrender.com", rootDirectory: "apps/admin", buildCommand: pnpmBuild, startCommand: "pnpm start", nodeVersion: "22.22.0", autoDeploy: true, healthPath: "/api/health", owner: "Platform Operations", notes: "Canonical administration and control-room service." },
  { serviceId: "srv-d9ve5ku1egvs73e3brk0", serviceName: "fuel-cap-web", role: "MARKETING", disposition: "CANONICAL", publicUrl: "https://fuel-cap-web.onrender.com", rootDirectory: "landing-page", buildCommand: pnpmBuild, startCommand: "pnpm start", nodeVersion: "22.22.0", autoDeploy: true, healthPath: null, owner: "Growth", notes: "Canonical marketing service behind fuelcap.tech." },
  { serviceId: "srv-d9hlsf7aqgkc73al5hl0", serviceName: "fuel-cap", role: "CONSUMER", disposition: "REVIEW_REQUIRED", publicUrl: "https://fuel-cap.onrender.com", rootDirectory: "", buildCommand: "npm install; npm run build", startCommand: "npm run start", nodeVersion: "UNVERIFIED", autoDeploy: true, healthPath: "/api/health", owner: "Founder decision required", notes: "Second root consumer deployment. Preserve until ownership, traffic, auth and retirement impact are explicitly reviewed." },
] as const;

export function evaluateServiceTopology(contracts: readonly RenderServiceContract[], observations: readonly RenderServiceObservation[]): ServiceTopologyAssessment {
  if (new Set(contracts.map(({ serviceId }) => serviceId)).size !== contracts.length) throw new Error("Service contract identifiers must be unique.");
  if (new Set(observations.map(({ serviceId }) => serviceId)).size !== observations.length) throw new Error("Observed service identifiers must be unique.");

  const blockers: string[] = [];
  const alignedServiceIds: string[] = [];
  const canonicalRoles = {} as Record<ApplicationRole, string>;
  for (const role of ["CONSUMER", "ADMIN", "MARKETING"] as const) {
    const canonical = contracts.filter((item) => item.role === role && item.disposition === "CANONICAL");
    if (canonical.length !== 1) blockers.push(`${role}: exactly one canonical service is required`);
    else canonicalRoles[role] = canonical[0].serviceId;
  }

  for (const contract of contracts) {
    const observed = observations.find(({ serviceId }) => serviceId === contract.serviceId);
    if (!observed) { blockers.push(`${contract.serviceName}: service observation is missing`); continue; }
    if (contract.disposition === "REVIEW_REQUIRED") {
      blockers.push(`${contract.serviceName}: product ownership and retirement decision remain open`);
      continue;
    }
    const drift = [
      observed.serviceName !== contract.serviceName && "name",
      observed.publicUrl !== contract.publicUrl && "public URL",
      observed.rootDirectory !== contract.rootDirectory && "root directory",
      observed.buildCommand !== contract.buildCommand && "build command",
      observed.startCommand !== contract.startCommand && "start command",
      observed.nodeVersion !== contract.nodeVersion && "Node version",
      observed.autoDeploy !== contract.autoDeploy && "auto-deploy",
    ].filter(Boolean);
    if (drift.length) blockers.push(`${contract.serviceName}: drift in ${drift.join(", ")}`);
    else if (observed.latestDeployStatus !== "live" || !/^[a-f0-9]{40}$/.test(observed.liveCommit ?? "")) blockers.push(`${contract.serviceName}: no provenance-valid live deployment`);
    else alignedServiceIds.push(contract.serviceId);
  }

  for (const observation of observations) if (!contracts.some(({ serviceId }) => serviceId === observation.serviceId)) blockers.push(`${observation.serviceName}: unregistered Render service`);
  return { decision: blockers.length ? "BLOCKED" : "ALIGNED", canonicalRoles, alignedServiceIds, blockers, deletionAuthorised: false };
}

export const seededTopologyAssessment = evaluateServiceTopology(renderServiceTopology, renderServiceTopology.map((service) => ({
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  publicUrl: service.publicUrl,
  rootDirectory: service.rootDirectory,
  buildCommand: service.buildCommand,
  startCommand: service.startCommand,
  nodeVersion: service.nodeVersion,
  autoDeploy: service.autoDeploy,
  liveCommit: "a2558b1caabdad4fa1ca143788443223dc101569",
  latestDeployStatus: "live",
})));
