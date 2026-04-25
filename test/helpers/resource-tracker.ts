export class ResourceTracker {
  private scaleIds: string[] = [];
  private versionIds: string[] = [];
  private templateIds: string[] = [];

  addScale(id: string) {
    this.scaleIds.push(id);
  }

  addVersion(id: string) {
    this.versionIds.push(id);
  }

  addTemplate(id: string) {
    this.templateIds.push(id);
  }

  getScaleIds(): string[] {
    return [...this.scaleIds];
  }

  getVersionIds(): string[] {
    return [...this.versionIds];
  }

  getTemplateIds(): string[] {
    return [...this.templateIds];
  }

  allResourceIds(): string[] {
    return [...this.versionIds, ...this.scaleIds];
  }

  clear() {
    this.scaleIds = [];
    this.versionIds = [];
    this.templateIds = [];
  }
}
