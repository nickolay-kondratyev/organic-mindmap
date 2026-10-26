import type { BranchPath, PathSample } from '../src/core/geometry/branchPath';
import type { Point } from '../src/core/model/node';

/**
 * Synthetic curved branch for tests: arc of `radius` around `center` from `startAngle`, sweeping `sweep`
 * radians (positive = increasing angle, which turns clockwise on screen because y points down).
 */
export class CircularArcPath implements BranchPath {
  readonly length: number;

  constructor(
    private readonly center: Point,
    private readonly radius: number,
    private readonly startAngle: number,
    private readonly sweep: number,
  ) {
    this.length = Math.abs(sweep) * radius;
  }

  sampleAt(arcLength: number): PathSample {
    const s = Math.min(this.length, Math.max(0, arcLength));
    const direction = Math.sign(this.sweep);
    const angle = this.startAngle + direction * (s / this.radius);
    return {
      point: { x: this.center.x + this.radius * Math.cos(angle), y: this.center.y + this.radius * Math.sin(angle) },
      tangent: { x: -direction * Math.sin(angle), y: direction * Math.cos(angle) },
    };
  }
}
