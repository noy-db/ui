import { describe, it, expect } from 'vitest'
import { useTour } from '../app/composables/useTour'
describe('useTour', () => {
  it('advances, clamps, and ends', () => {
    const tour = useTour()
    tour.start([{ target: '[data-tour=a]', title: 'A', body: 'a' }, { target: '[data-tour=b]', title: 'B', body: 'b' }], { force: true })
    expect(tour.active.value).toBe(true); expect(tour.index.value).toBe(0)
    tour.next(); expect(tour.index.value).toBe(1)
    tour.next(); expect(tour.active.value).toBe(false)   // past the end → closes
    tour.start([{ target: '[data-tour=a]', title: 'A', body: 'a' }], { force: true }); tour.skip()
    expect(tour.active.value).toBe(false)
  })
})
