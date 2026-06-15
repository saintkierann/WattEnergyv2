export interface Totals {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface MealItem {
  n: string;
  kcal: number;
}

export interface QOpt {
  l: string;
  kcal?: number;
  p?: number;
  c?: number;
  f?: number;
}

export interface Question {
  q: string;
  why: string;
  opts: QOpt[];
}

export interface MealData {
  title: string;
  items: MealItem[];
  base: Totals;
  confidence: string;
  note: string;
  questions: Question[];
}

export interface LoggedMeal {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  img?: string | null;
}

export interface Activity {
  kcal: number;
  steps: number;
  run: number;
  bike: number;
  swim: number;
}

export interface ActOn {
  steps: boolean;
  run: boolean;
  bike: boolean;
  swim: boolean;
}

export interface MacroColors {
  p: string;
  c: string;
  f: string;
}

// Props passed to the canvas renderers.
export interface RenderProps {
  totals: Totals;
  title?: string;
  img?: HTMLImageElement | null;
  handle?: string;
  showHandle?: boolean;
  ink?: string;
  monoMacros?: boolean;
  macroColors?: MacroColors;
  caloriesIn?: number;
  act?: Activity;
  actOn?: Partial<ActOn>;
  // day-summary
  meals?: LoggedMeal[];
  imgs?: (HTMLImageElement | null)[];
}
