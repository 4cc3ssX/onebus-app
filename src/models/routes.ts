import logger from "@/lib/logger";
import { ILogger } from "@/typescript/logger";
import { IRoute, IRouteSearchType } from "@/typescript/models/routes";
import { Collection, Db, Document, Filter, MongoClient } from "mongodb";

export class Routes {
  private _logger: ILogger;
  private _db: Db;
  private _collection: Collection<IRoute>;
  private _defaultProjection: Document = { _id: 0 };

  constructor(_client: MongoClient, _logger: ILogger = logger) {
    this._logger = _logger;

    this._db = _client.db();
    this._collection = this._db.collection<IRoute>("routes");
  }

  /**
   * Retrieves all routes based on the provided search criteria.
   *
   * @param {IRouteSearchType} route The search criteria for routes.
   * @return {Promise<IRoute[]>} A promise that resolves to an array of routes.
   */
  async findAllRoutes(route: IRouteSearchType): Promise<IRoute[]> {
    const filters: Filter<IRoute> = { $and: [] };

    // loop through each property in the route object
    Object.entries(route).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        filters.$and?.push({
          $or: [
            { [key]: new RegExp(`${value}`, "i") },
            { [key]: new RegExp(`${value}`, "i") },
          ],
        });
      }
    });

    // If there are no filters, remove the $and property
    if (filters.$and?.length === 0) {
      delete filters.$and;
    }

    const routes = await this._collection
      .find(filters)
      .project(this._defaultProjection)
      .sort({ route_id: 1 }, "asc")
      .toArray();

    return routes as IRoute[];
  }

  /**
   * Retrieves a route by its ID.
   *
   * @param {string} id - The ID of the route.
   * @return {Promise<IRoute | null>} A promise that resolves to the route object or null if not found.
   */
  async getRoute(id: string): Promise<IRoute | null> {
    const route = await this._collection.findOne(
      { route_id: id },
      {
        projection: this._defaultProjection,
      }
    );

    return route;
  }
}
