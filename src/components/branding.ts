/**
 * Minimal branding shape shared by presentational components that only need
 * an accent color. Both the exhibition `DemoProgram` catalog and Universe
 * `ProgramDefinition.branding` satisfy this structurally, so Season screens
 * can reuse these components without duplicating color/name/prestige data.
 */
export interface BrandingSource {
  readonly primaryColor: string
}
