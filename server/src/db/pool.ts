import { Pool } from "pg";

export function createDatabasePool(): Pool {
    return new Pool();
}