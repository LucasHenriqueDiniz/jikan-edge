import { describe, expect, it } from 'vitest';
import { parsePagination } from '../../src/domain/pagination';
describe('pagination', () => { it('caps the API limit', () => expect(parsePagination('0', '999')).toEqual({ page: 1, limit: 300 })); });
