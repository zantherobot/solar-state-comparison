import compiledDataset from "../data/compiled_data.json";
import type { CompiledDataset } from "./types";

const dataset = compiledDataset as CompiledDataset;

export const stateData = dataset.states;
export const metadata = dataset.metadata;
export default dataset;
