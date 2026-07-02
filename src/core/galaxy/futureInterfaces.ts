// V2 keeps these as research contracts only. They intentionally have no implementation yet.

export interface EmbeddingSpaceAdapter<TInput, TVector> {
  embed(input: TInput): Promise<TVector>;
}

export interface ClusterAlgorithm<TPoint, TCluster> {
  cluster(points: TPoint[]): Promise<TCluster[]>;
}

export interface AttractorModel<TState> {
  findAttractors(state: TState): Promise<unknown[]>;
}

export interface PhaseTransitionDetector<TState> {
  detect(previous: TState, next: TState): Promise<unknown | undefined>;
}

export interface BayesianBeliefUpdater<TBelief, TEvidence> {
  update(belief: TBelief, evidence: TEvidence): Promise<TBelief>;
}

export interface HigherDimensionalCharacterSpace<TStateVector> {
  project(state: TStateVector, dimensions: string[]): unknown;
}
