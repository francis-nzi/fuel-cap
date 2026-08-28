export const BASIS_MODEL_VERSION = "basis-model@0.1.0" as const;
export type BasisStrategy = "ROLLING_MEAN" | "ROLLING_MEDIAN";
export type BasisObservation = Readonly<{ observationId: string; market: string; effectiveAt: string; retailPriceMinor4: number; wholesaleHedgePriceMinor4: number; retailEvidenceId: string; wholesaleEvidenceId: string; provenance: "SYNTHETIC_SEEDED" }>;
export type BasisPoint = BasisObservation & Readonly<{ signedBasisMinor4: number }>;
export type BasisCandidateSpec = Readonly<{ candidateId: string; strategy: BasisStrategy; windowSize: number }>;
export type BasisCandidateResult = Readonly<{ candidateId: string; strategy: BasisStrategy; windowSize: number; status: "PASS" | "REJECTED"; reasonCodes: readonly string[]; holdoutCount: number; meanAbsoluteErrorMinor4: number | null; maximumAbsoluteErrorMinor4: number | null; signedBiasMinor4: number | null; forecastBasisMinor4: number | null; evidenceIds: readonly string[] }>;
export type BasisOptimizationPolicy = Readonly<{ policyId: string; minimumObservationCount: number; minimumHoldoutCount: number; maximumMeanAbsoluteErrorMinor4: number; maximumAbsoluteErrorMinor4: number; maximumSignedBiasAbsoluteMinor4: number; permittedWindows: readonly number[]; permittedStrategies: readonly BasisStrategy[] }>;
export type BasisOptimizationDecision = Readonly<{ decisionId: string; version: typeof BASIS_MODEL_VERSION; status: "SELECTED" | "BLOCKED"; reasonCode: "MODEL_SELECTED" | "NO_ELIGIBLE_MODEL" | "INPUT_INVALID"; decidedAt: string; policyId: string; selectedCandidateId: string | null; selectedForecastBasisMinor4: number | null; candidates: readonly BasisCandidateResult[]; observationCount: number; holdoutCount: number; noLookahead: true; simulationOnly: true; quoteEligible: false; hedgeExecutionEligible: false }>;
export type BasisModelProposal = Readonly<{ proposalId: string; decisionId: string; selectedCandidateId: string; forecastBasisMinor4: number; evidenceDigest: `sha256:${string}`; makerId: string; reason: string; rollbackReference: string; state: "PENDING_APPROVAL"; proposedAt: string }>;
export type PublishedBasisModel = Readonly<{ modelId: string; modelVersion: typeof BASIS_MODEL_VERSION; proposalId: string; decisionId: string; selectedCandidateId: string; forecastBasisMinor4: number; makerId: string; checkerId: string; evidenceDigest: `sha256:${string}`; publishedAt: string; state: "PUBLISHED"; permittedUses: readonly ["DISPLAY","SIMULATE"]; quoteEligible: false; hedgeExecutionEligible: false }>;

const validInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
export function toBasisPoints(observations: readonly BasisObservation[]): readonly BasisPoint[] {
  if (observations.some((item)=>!item.observationId.trim() || !item.market.trim() || !Number.isFinite(Date.parse(item.effectiveAt)) || !validInteger(item.retailPriceMinor4) || !validInteger(item.wholesaleHedgePriceMinor4) || !item.retailEvidenceId.trim() || !item.wholesaleEvidenceId.trim())) throw new Error("Complete positive fixed-point observations and evidence are required.");
  const ordered = [...observations].sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt) || a.observationId.localeCompare(b.observationId));
  if (new Set(ordered.map(({observationId})=>observationId)).size !== ordered.length || new Set(ordered.map(({effectiveAt})=>effectiveAt)).size !== ordered.length || new Set(ordered.map(({market})=>market)).size !== 1) throw new Error("Observations must be unique, time-distinct and single-market.");
  return ordered.map((item)=>({...item,signedBasisMinor4:item.retailPriceMinor4-item.wholesaleHedgePriceMinor4}));
}
const mean = (values: readonly number[]) => Math.round(values.reduce((sum,value)=>sum+value,0)/values.length);
const median = (values: readonly number[]) => { const ordered=[...values].sort((a,b)=>a-b); const middle=Math.floor(ordered.length/2); return ordered.length%2 ? ordered[middle]! : Math.round((ordered[middle-1]!+ordered[middle]!)/2); };
const forecast = (strategy: BasisStrategy, values: readonly number[]) => strategy === "ROLLING_MEDIAN" ? median(values) : mean(values);

export function evaluateBasisCandidate(points: readonly BasisPoint[], spec: BasisCandidateSpec, holdoutCount: number, policy: BasisOptimizationPolicy): BasisCandidateResult {
  const reasons: string[]=[];
  if (!policy.permittedStrategies.includes(spec.strategy)) reasons.push("STRATEGY_NOT_PERMITTED");
  if (!policy.permittedWindows.includes(spec.windowSize) || spec.windowSize < 2) reasons.push("WINDOW_NOT_PERMITTED");
  if (!Number.isInteger(holdoutCount) || holdoutCount < policy.minimumHoldoutCount || points.length-holdoutCount < spec.windowSize) reasons.push("INSUFFICIENT_HOLDOUT_HISTORY");
  if (reasons.length) return { ...spec,status:"REJECTED",reasonCodes:reasons,holdoutCount,meanAbsoluteErrorMinor4:null,maximumAbsoluteErrorMinor4:null,signedBiasMinor4:null,forecastBasisMinor4:null,evidenceIds:[] };
  const first=points.length-holdoutCount; const errors:number[]=[];
  for(let index=first;index<points.length;index++){ const history=points.slice(index-spec.windowSize,index).map(({signedBasisMinor4})=>signedBasisMinor4); errors.push(forecast(spec.strategy,history)-points[index]!.signedBasisMinor4); }
  const mae=mean(errors.map(Math.abs)); const maximum=Math.max(...errors.map(Math.abs)); const bias=mean(errors);
  if(mae>policy.maximumMeanAbsoluteErrorMinor4) reasons.push("MAE_LIMIT_EXCEEDED");
  if(maximum>policy.maximumAbsoluteErrorMinor4) reasons.push("MAX_ERROR_LIMIT_EXCEEDED");
  if(Math.abs(bias)>policy.maximumSignedBiasAbsoluteMinor4) reasons.push("BIAS_LIMIT_EXCEEDED");
  const forecastBasisMinor4=forecast(spec.strategy,points.slice(-spec.windowSize).map(({signedBasisMinor4})=>signedBasisMinor4));
  return { ...spec,status:reasons.length?"REJECTED":"PASS",reasonCodes:reasons,holdoutCount,meanAbsoluteErrorMinor4:mae,maximumAbsoluteErrorMinor4:maximum,signedBiasMinor4:bias,forecastBasisMinor4,evidenceIds:points.flatMap(({retailEvidenceId,wholesaleEvidenceId})=>[retailEvidenceId,wholesaleEvidenceId]) };
}

export function optimizeBasisModel(input: Readonly<{ decisionId:string; decidedAt:string; observations:readonly BasisObservation[]; candidates:readonly BasisCandidateSpec[]; holdoutCount:number; policy:BasisOptimizationPolicy }>): BasisOptimizationDecision {
  if(!input.decisionId.trim() || !Number.isFinite(Date.parse(input.decidedAt)) || input.observations.length<input.policy.minimumObservationCount || !input.candidates.length) return {decisionId:input.decisionId,version:BASIS_MODEL_VERSION,status:"BLOCKED",reasonCode:"INPUT_INVALID",decidedAt:input.decidedAt,policyId:input.policy.policyId,selectedCandidateId:null,selectedForecastBasisMinor4:null,candidates:[],observationCount:input.observations.length,holdoutCount:input.holdoutCount,noLookahead:true,simulationOnly:true,quoteEligible:false,hedgeExecutionEligible:false};
  const points=toBasisPoints(input.observations); const candidates=input.candidates.map((spec)=>evaluateBasisCandidate(points,spec,input.holdoutCount,input.policy));
  const selected=candidates.filter((item)=>item.status==="PASS").sort((a,b)=>a.meanAbsoluteErrorMinor4!-b.meanAbsoluteErrorMinor4! || Math.abs(a.signedBiasMinor4!)-Math.abs(b.signedBiasMinor4!) || a.windowSize-b.windowSize || a.candidateId.localeCompare(b.candidateId))[0];
  return {decisionId:input.decisionId,version:BASIS_MODEL_VERSION,status:selected?"SELECTED":"BLOCKED",reasonCode:selected?"MODEL_SELECTED":"NO_ELIGIBLE_MODEL",decidedAt:input.decidedAt,policyId:input.policy.policyId,selectedCandidateId:selected?.candidateId??null,selectedForecastBasisMinor4:selected?.forecastBasisMinor4??null,candidates,observationCount:points.length,holdoutCount:input.holdoutCount,noLookahead:true,simulationOnly:true,quoteEligible:false,hedgeExecutionEligible:false};
}

export function proposeBasisModel(decision:BasisOptimizationDecision,input:Readonly<{proposalId:string;evidenceDigest:`sha256:${string}`;makerId:string;reason:string;rollbackReference:string;proposedAt:string}>):BasisModelProposal{
  if(decision.status!=="SELECTED" || !decision.selectedCandidateId || decision.selectedForecastBasisMinor4===null || !input.proposalId.trim() || !/^sha256:[a-f0-9]{64}$/.test(input.evidenceDigest) || !input.makerId.trim() || !input.reason.trim() || !input.rollbackReference.trim() || !Number.isFinite(Date.parse(input.proposedAt))) throw new Error("A selected decision and complete governed proposal evidence are required.");
  return {...input,decisionId:decision.decisionId,selectedCandidateId:decision.selectedCandidateId,forecastBasisMinor4:decision.selectedForecastBasisMinor4,state:"PENDING_APPROVAL"};
}
export function publishBasisModel(modelId:string,proposal:BasisModelProposal,input:Readonly<{checkerId:string;assurance:"STEP_UP";evidenceDigest:string;publishedAt:string}>):PublishedBasisModel{
  if(!modelId.trim() || !input.checkerId.trim() || input.checkerId===proposal.makerId || input.assurance!=="STEP_UP" || input.evidenceDigest!==proposal.evidenceDigest || !Number.isFinite(Date.parse(input.publishedAt)) || Date.parse(input.publishedAt)<Date.parse(proposal.proposedAt)) throw new Error("Different-checker step-up approval of the exact proposal is required.");
  return {modelId,modelVersion:BASIS_MODEL_VERSION,proposalId:proposal.proposalId,decisionId:proposal.decisionId,selectedCandidateId:proposal.selectedCandidateId,forecastBasisMinor4:proposal.forecastBasisMinor4,makerId:proposal.makerId,checkerId:input.checkerId,evidenceDigest:proposal.evidenceDigest,publishedAt:input.publishedAt,state:"PUBLISHED",permittedUses:["DISPLAY","SIMULATE"],quoteEligible:false,hedgeExecutionEligible:false};
}

export const seededBasisObservations:readonly BasisObservation[]=[520,545,510,570,560,590,575,605,595,620,610,630].map((basis,index)=>({observationId:`BASIS-EU-${String(index+1).padStart(2,"0")}`,market:"EU-DE-DIESEL",effectiveAt:new Date(Date.UTC(2026,5+index,1)).toISOString(),retailPriceMinor4:16_000+basis,wholesaleHedgePriceMinor4:16_000,retailEvidenceId:`RETAIL-${index+1}`,wholesaleEvidenceId:`WHOLESALE-${index+1}`,provenance:"SYNTHETIC_SEEDED"}));
export const seededBasisPolicy:BasisOptimizationPolicy={policyId:"BASIS-POLICY-1",minimumObservationCount:10,minimumHoldoutCount:3,maximumMeanAbsoluteErrorMinor4:60,maximumAbsoluteErrorMinor4:100,maximumSignedBiasAbsoluteMinor4:60,permittedWindows:[4,6,8],permittedStrategies:["ROLLING_MEAN","ROLLING_MEDIAN"]};
export const seededBasisDecision=optimizeBasisModel({decisionId:"BASIS-OPT-EU-DE-1",decidedAt:"2027-05-02T00:00:00Z",observations:seededBasisObservations,candidates:seededBasisPolicy.permittedWindows.flatMap((windowSize)=>seededBasisPolicy.permittedStrategies.map((strategy)=>({candidateId:`${strategy}-${windowSize}`,strategy,windowSize}))),holdoutCount:4,policy:seededBasisPolicy});
const seededProposal=proposeBasisModel(seededBasisDecision,{proposalId:"BASIS-PROPOSAL-EU-DE-1",evidenceDigest:"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",makerId:"principal-risk",reason:"Select the lowest-error transparent basis candidate.",rollbackReference:"RB-BASIS-EU-DE-1",proposedAt:"2027-05-02T00:01:00Z"});
export const seededPublishedBasisModel=publishBasisModel("BASIS-MODEL-EU-DE-1",seededProposal,{checkerId:"principal-data",assurance:"STEP_UP",evidenceDigest:seededProposal.evidenceDigest,publishedAt:"2027-05-02T00:02:00Z"});
