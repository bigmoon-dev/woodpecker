export class ResourceTracker {
  private scaleIds: string[] = [];
  private versionIds: string[] = [];

  addScale(id: string) {
    this.scaleIds.push(id);
  }

  addVersion(id: string) {
    this.versionIds.push(id);
  }

  getScaleIds(): string[] {
    return [...this.scaleIds];
  }

  getVersionIds(): string[] {
    return [...this.versionIds];
  }

  allResourceIds(): string[] {
    return [...this.versionIds, ...this.scaleIds];
  }

  clear() {
    this.scaleIds = [];
    this.versionIds = [];
  }
}
