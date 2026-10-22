export interface IntroductionStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> }
export type IntroductionStatus = 'pending' | 'done' | null;
export function createMarketplaceIntroductionService(storage: IntroductionStorage) {
  const key = (id: string) => `@rentlease/matching-introduction/v1/${encodeURIComponent(id)}`;
  return {
    async read(id: string): Promise<IntroductionStatus> {
      const value = await storage.getItem(key(id));
      if (value === null || value === 'pending' || value === 'done') return value;
      throw Error('Invalid local introduction marker.');
    },
    async markPending(id: string) {
      // A completed account must not be reintroduced by another signup notification.
      if (await storage.getItem(key(id)) !== 'done') await storage.setItem(key(id), 'pending');
    },
    async complete(id: string) {
      const value = await storage.getItem(key(id));
      if (value !== 'pending' && value !== 'done') throw Error('Pending introduction not found.');
      if (value !== 'done') await storage.setItem(key(id), 'done');
    },
  };
}
export type MarketplaceIntroductionService = ReturnType<typeof createMarketplaceIntroductionService>;
