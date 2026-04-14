export interface RouteConfig {
  path: string;
  component?: React.ComponentType;
  layout?: React.ComponentType<{ children?: React.ReactNode }>;
  roles?: string[];
  public?: boolean;
  children?: { path: string; component: React.ComponentType; permission?: string }[];
}
