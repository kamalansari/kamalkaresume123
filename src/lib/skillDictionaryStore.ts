// Runtime-overridable hard-skill dictionary used by atsScore.ts.
// Admins can edit phrases/singles in the UI; values are persisted in
// localStorage and broadcast via a CustomEvent so any open page (Builder,
// ATS panel, /ats) re-scores automatically.

const PHRASES_KEY = "resumeforge.skillDict.phrases.v1";
const SINGLES_KEY = "resumeforge.skillDict.singles.v1";
export const SKILL_DICT_EVENT = "resumeforge:skill-dict-changed";

export const DEFAULT_HARD_SKILL_PHRASES: string[] = [
  // BI / reporting platforms
  "power bi","power query","power pivot","power automate","dax",
  "tableau","tableau prep","qlikview","qlik sense","looker","looker studio",
  "google data studio","sap bo","sap businessobjects","sap bw","sap hana",
  "microstrategy","domo","cognos","ibm cognos","crystal reports","sisense",
  // Spreadsheets / desktop
  "advanced excel","ms excel","microsoft excel","excel macros","vba","vlookup",
  "hlookup","xlookup","pivot tables","pivot table","index match","array formulas",
  "google sheets","ms access","microsoft access",
  // Reporting domains
  "mis reporting","mis report","management reporting","financial reporting",
  "financial modeling","financial modelling","financial analysis","variance analysis",
  "ratio analysis","trend analysis","cost analysis","profitability analysis",
  "budgeting","forecasting","budget forecasting","cash flow","p&l","p & l",
  "balance sheet","general ledger","accounts payable","accounts receivable",
  "revenue analysis","kpi reporting","kpi dashboard","kpi tracking",
  "dashboard development","dashboard design","reporting automation",
  // Data engineering / databases
  "sql","t-sql","pl/sql","mysql","postgresql","postgres","oracle","ms sql",
  "sql server","mssql","mongodb","nosql","snowflake","redshift","bigquery",
  "databricks","azure synapse","stored procedures","data warehouse",
  "data warehousing","data modeling","data modelling","data mart","etl",
  "elt","ssis","ssrs","ssas","informatica","talend","alteryx","airflow",
  // Programming / scripting
  "python","pandas","numpy","matplotlib","seaborn","plotly","scipy","scikit-learn",
  "r programming","r language","sas","spss","stata","matlab","julia",
  "javascript","typescript",
  // Cloud / platforms
  "aws","azure","gcp","google cloud","aws s3","aws redshift","azure data factory",
  "azure data lake","aws glue",
  // Data concepts / methods
  "data analysis","data analytics","data visualization","data visualisation",
  "data cleansing","data cleaning","data wrangling","data mining","data quality",
  "data governance","data validation","data extraction","data transformation",
  "data integration","data migration","data reconciliation","data interpretation",
  "statistical analysis","statistical modeling","regression analysis",
  "hypothesis testing","predictive analytics","predictive modeling","time series",
  "machine learning","deep learning","exploratory data analysis","eda",
  "ab testing","a/b testing","root cause analysis","gap analysis",
  // Business / finance domain
  "gst","tds","ifrs","gaap","us gaap","ind as","sox","sox compliance",
  "audit","internal audit","statutory audit","taxation","reconciliation",
  "bank reconciliation","invoicing","accounting","bookkeeping","tally",
  "sap","sap fico","oracle erp","quickbooks","zoho books","netsuite",
  // Process / methodology
  "agile","scrum","jira","confluence","six sigma","lean","kaizen",
  "business intelligence","business analysis","requirement gathering",
  "stakeholder management","process improvement","automation",
];

export const DEFAULT_HARD_SKILL_SINGLES: string[] = [
  "sql","python","excel","tableau","powerbi","dax","vba","sas","spss","r",
  "etl","elt","ssis","ssrs","ssas","snowflake","redshift","bigquery",
  "databricks","airflow","alteryx","informatica","talend",
  "mysql","postgresql","postgres","oracle","mssql","mongodb","nosql",
  "aws","azure","gcp","hana",
  "forecasting","budgeting","reconciliation","accounting","auditing",
  "analytics","reporting","dashboards","kpi","kpis","mis","erp","crm",
  "sap","tally","quickbooks","netsuite",
  "pandas","numpy","matplotlib","seaborn","plotly","scipy","jupyter",
  "javascript","typescript","java","scala",
  "statistics","regression","forecast","modeling","modelling",
  "agile","scrum","jira","confluence",
];

function safeRead(key: string, fallback: string[]): string[] {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  } catch {
    return fallback;
  }
}

export const skillDictStore = {
  getPhrases(): string[] {
    return safeRead(PHRASES_KEY, DEFAULT_HARD_SKILL_PHRASES);
  },
  getSingles(): string[] {
    return safeRead(SINGLES_KEY, DEFAULT_HARD_SKILL_SINGLES);
  },
  save(phrases: string[], singles: string[]) {
    if (typeof localStorage === "undefined") return;
    const cleanP = Array.from(new Set(phrases.map((s) => s.trim().toLowerCase()).filter(Boolean)));
    const cleanS = Array.from(new Set(singles.map((s) => s.trim().toLowerCase()).filter(Boolean)));
    localStorage.setItem(PHRASES_KEY, JSON.stringify(cleanP));
    localStorage.setItem(SINGLES_KEY, JSON.stringify(cleanS));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SKILL_DICT_EVENT));
    }
  },
  reset() {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(PHRASES_KEY);
    localStorage.removeItem(SINGLES_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SKILL_DICT_EVENT));
    }
  },
};

// Tiny React hook: returns a counter that bumps whenever the dictionary
// changes. Include the returned value in a `useMemo` deps array to force a
// recompute when an admin edits the dictionary in another tab/page.
import { useEffect, useState } from "react";
export function useSkillDictVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setV((x) => x + 1);
    window.addEventListener(SKILL_DICT_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("resumeforge.skillDict.")) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SKILL_DICT_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return v;
}