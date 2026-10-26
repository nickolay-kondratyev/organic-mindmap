import { routeSetViewState, type SetViewStateHost } from './viewRouting';

interface FakeViewState {
  readonly type: string;
}

/** Stands in for `WorkspaceLeaf`: records the view types its original `setViewState` received. */
class FakeLeaf implements SetViewStateHost<FakeViewState> {
  readonly shown: string[] = [];

  async setViewState(viewState: FakeViewState): Promise<void> {
    this.shown.push(viewState.type);
  }
}

const ROUTED_TYPE = 'routed';

/** Routes every `markdown` request to `ROUTED_TYPE`. */
async function routeMarkdown(_leaf: FakeLeaf, viewState: FakeViewState): Promise<FakeViewState> {
  return viewState.type === 'markdown' ? { type: ROUTED_TYPE } : viewState;
}

/** Another plugin's wrapper, installed by plain assignment (what a hand-rolled wrap would do). */
function wrapByOtherPlugin(prototype: typeof FakeLeaf.prototype, seen: string[]): void {
  const previous = prototype.setViewState;
  prototype.setViewState = async function (this: FakeLeaf, viewState: FakeViewState) {
    seen.push(viewState.type);
    return previous.call(this, viewState);
  };
}

describe('routeSetViewState', () => {
  describe('GIVEN the routing installed on a leaf prototype', () => {
    it('WHEN a leaf shows a view state THEN the original receives the routed one', async () => {
      const leaf = new FakeLeaf();
      const uninstall = routeSetViewState(FakeLeaf.prototype, routeMarkdown);
      await leaf.setViewState({ type: 'markdown' });
      uninstall();
      expect(leaf.shown).toEqual([ROUTED_TYPE]);
    });

    it('WHEN it is uninstalled while still outermost THEN the prototype holds the original again', () => {
      const original = FakeLeaf.prototype.setViewState;
      const uninstall = routeSetViewState(FakeLeaf.prototype, routeMarkdown);
      uninstall();
      expect(FakeLeaf.prototype.setViewState).toBe(original);
    });
  });

  describe('GIVEN another plugin wrapped setViewState after our routing was installed', () => {
    it('WHEN our routing is uninstalled THEN the other wrapper still runs and our routing no longer applies', async () => {
      const original = FakeLeaf.prototype.setViewState;
      const seenByOther: string[] = [];
      const uninstall = routeSetViewState(FakeLeaf.prototype, routeMarkdown);
      wrapByOtherPlugin(FakeLeaf.prototype, seenByOther);
      uninstall();
      const leaf = new FakeLeaf();
      await leaf.setViewState({ type: 'markdown' });
      FakeLeaf.prototype.setViewState = original;
      expect({ seenByOther, shown: leaf.shown }).toEqual({ seenByOther: ['markdown'], shown: ['markdown'] });
    });
  });
});
