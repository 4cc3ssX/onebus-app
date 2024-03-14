import {
  IRoute,
  ITransferPoint,
  ITransitRoute,
  TransitType,
} from "@/typescript/models/routes";
import { StopModelHelper } from "./stops";
import { point } from "@turf/helpers";
import { IStop } from "@/typescript/models/stops";
import { createLineSlice, createLineString } from ".";
import length from "@turf/length";
import { DistanceUnits } from "../validations";
import { ICoordinates } from "@/typescript/models";
import { intersection, omit } from "lodash-es";

export class RouteModelHelper {
  private from!: IStop[];
  private to!: IStop[];
  private visitedRoute = new Set<IRoute>();

  public _transitRoutes: ITransitRoute[] = [];
  private _transferPoints: ITransferPoint[] = [];

  constructor(
    private stops: IStop[],
    private routes: IRoute[],
    private userPosition: ICoordinates | null,
    private count: number,
    private distanceUnit: DistanceUnits
  ) {
    this.findTransferPoints();
  }

  get transitRoutes() {
    const sortedTransitRoutes = RouteModelHelper.sortTransitRoutes(
      this._transitRoutes
    );
    return sortedTransitRoutes.slice(0, this.count);
  }

  public updateFromStops(from: IStop[]) {
    this.from = from;
  }

  public updateToStops(to: IStop[]) {
    this.to = to;
  }

  /**
   * Finds and returns an array of transfer points.
   *
   */
  private findTransferPoints() {
    for (const stop of this.stops) {
      const routes = this.routes.filter((route) =>
        route.stops.includes(stop.id)
      );
      this._transferPoints.push({ stop: stop.id, routes });
    }
  }

  /**
   * Finds transit routes between two stops.
   *
   * @return {void}
   */
  public findTransitRoutes(): void {
    if (!this.from || !this.to) {
      // Invalid route parameters
      return;
    }

    const fromTransferPoint = this._transferPoints.find((ftp) =>
      this.from.some((f) => ftp.stop === f.id)
    );

    const toTransferPoint = this._transferPoints.find((ttp) =>
      this.to.some((t) => ttp.stop === t.id)
    );

    if (!fromTransferPoint || !toTransferPoint) {
      // stop cannot be found
      return;
    }

    fromLoop: for (const fromRoute of fromTransferPoint.routes) {
      const fromRouteLineString = createLineString(
        fromRoute.coordinates,
        fromRoute.route_id
      );

      // direct route check
      if (
        intersection(
          fromRoute.stops,
          [this.from.slice(0, 1), this.to.slice(0, 1)].flat().map((s) => s.id)
        ).length === 2
      ) {
        // push found route to visitedRoute
        if (!this.visitedRoute.has(fromRoute)) {
          this.visitedRoute.add(fromRoute);
        }

        const inBetweenStops = StopModelHelper.findInBetweenStops(
          this.from,
          this.to,
          fromRoute.stops.map(
            (s) => this.stops.find((stop) => stop.id === s) as IStop
          )
        );

        const fromStop = this.stops.find(
          (stop) => stop.id === inBetweenStops.at(-1)?.id
        ) as IStop;

        const toStop = this.stops.find(
          (stop) => stop.id === inBetweenStops.at(-1)?.id
        ) as IStop;

        // start point
        const startPoint = point([fromStop.lng, fromStop.lat], fromStop, {
          id: fromStop.id,
        });
        // end point
        const endPoint = point([toStop.lng, toStop.lat], toStop, {
          id: toStop.id,
        });

        const routeLineSlice = createLineSlice(
          startPoint,
          endPoint,
          fromRouteLineString
        );

        const routeLength = length(routeLineSlice, {
          units: this.distanceUnit,
        });

        this._transitRoutes.push({
          id: fromRoute.route_id,
          routes: [
            {
              ...fromRoute,
              stops: inBetweenStops.map((stop) => stop.id),
              coordinates:
                routeLineSlice.geometry.coordinates.map<ICoordinates>(
                  ([lng, lat]) => ({
                    lng,
                    lat,
                  })
                ),
            },
          ],
          transitSteps: [
            {
              type: TransitType.TRANSIT,
              step: omit(fromRoute, ["stops", "coordinates"]),
              distance: routeLength,
            },
          ],

          distance: routeLength,
        });
      }

      // break the loop if the maximum number of routes is reached
      if (this._transitRoutes.length >= this.count) {
        return;
      }

      toLoop: for (const toRoute of toTransferPoint.routes) {
        const toRouteLineString = createLineString(
          toRoute.coordinates,
          toRoute.route_id
        );

        const commonStops = fromRoute.stops.filter((fsid) =>
          toRoute.stops.includes(fsid)
        );

        // 2 transits
        if (commonStops.length > 0) {
          const routeId = `${fromRoute.route_id} - ${toRoute.route_id}`;

          // check previous existing transits
          if (this.visitedRoute.has(fromRoute)) {
            continue fromLoop;
          }

          // check toRoute is visited by fromRoute
          if (this.visitedRoute.has(toRoute)) {
            continue toLoop;
          }

          // check previous existing transits
          if (!this._transitRoutes.some((tr) => tr.id === routeId)) {
            const commonStop = this.stops.find((stop) => {
              const commonStopId = commonStops.at(-1);

              return (
                !this.to.some((ts) => ts.id === commonStopId) &&
                stop.id === commonStopId
              );
            }) as IStop;

            if (!this.visitedRoute.has(fromRoute)) {
              this.visitedRoute.add(fromRoute);
            }

            const startCommonStops = this.stops.filter(
              (stop) =>
                stop.name.en === commonStop.name.en &&
                stop.road.en === commonStop.road.en &&
                stop.township.en === commonStop.township.en
            );

            // find in-between stops
            const fromInBetweenStops = StopModelHelper.findInBetweenStops(
              this.from,
              startCommonStops,
              fromRoute.stops.map(
                (s) => this.stops.find((stop) => stop.id === s) as IStop
              )
            );

            const toInBetweenStops = StopModelHelper.findInBetweenStops(
              startCommonStops,
              this.to,
              toRoute.stops.map(
                (s) => this.stops.find((stop) => stop.id === s) as IStop
              )
            );

            const fromStop = this.stops.find(
              (stop) => stop.id === fromInBetweenStops.at(-1)?.id
            ) as IStop;

            const toStop = this.stops.find(
              (stop) => stop.id === toInBetweenStops.at(-1)?.id
            ) as IStop;

            // start point
            const startPoint = point([fromStop.lng, fromStop.lat], fromStop, {
              id: fromStop.id,
            });
            // end point
            const endPoint = point([toStop.lng, toStop.lat], toStop, {
              id: toStop.id,
            });

            // commonStop point to make slice line string
            const commonStopPoint = point([commonStop.lng, commonStop.lat]);

            const fromRouteLineSlice = createLineSlice(
              startPoint,
              commonStopPoint,
              fromRouteLineString,
              routeId
            );

            const toRouteLineSlice = createLineSlice(
              commonStopPoint,
              endPoint,
              toRouteLineString,
              routeId
            );

            // calculate sliced line string length
            const fromRouteLength = length(fromRouteLineSlice, {
              units: this.distanceUnit,
            });

            const toRouteLength = length(toRouteLineSlice, {
              units: this.distanceUnit,
            });

            // push to array
            this._transitRoutes.push({
              id: routeId,
              routes: [
                {
                  ...fromRoute,
                  stops: fromInBetweenStops.map((stop) => stop.id),
                  coordinates: fromRouteLineSlice.geometry.coordinates.map(
                    ([lng, lat]) => ({
                      lng,
                      lat,
                    })
                  ),
                },
                {
                  ...toRoute,
                  stops: toInBetweenStops.map((stop) => stop.id),
                  coordinates: toRouteLineSlice.geometry.coordinates.map(
                    ([lng, lat]) => ({
                      lng,
                      lat,
                    })
                  ),
                },
              ],
              transitSteps: [
                {
                  type: TransitType.TRANSIT,
                  step: omit(fromRoute, ["stops", "coordinates"]),
                  distance: fromRouteLength,
                },
                {
                  type: TransitType.TRANSIT,
                  step: omit(toRoute, ["stops", "coordinates"]),
                  distance: toRouteLength,
                },
              ],

              distance: fromRouteLength + toRouteLength,
            });
          }
        }
      }
    }

    if (this._transitRoutes.length >= this.count) {
      return;
    }

    for (const fromRoute of fromTransferPoint.routes) {
      const fromRouteLineString = createLineString(
        fromRoute.coordinates,
        fromRoute.route_id
      );

      for (const toRoute of toTransferPoint.routes) {
        const toRouteLineString = createLineString(
          toRoute.coordinates,
          toRoute.route_id
        );

        // 3 transits
        joinRoute: for (const joinRoute of this.routes) {
          // skip if join route is same as from and to route
          if (
            joinRoute.route_id === fromRoute.route_id ||
            joinRoute.route_id === toRoute.route_id ||
            this.visitedRoute.has(joinRoute)
          ) {
            continue;
          }

          // check if can join
          const joinStartCommonStops = fromRoute.stops.filter((fsid) =>
            joinRoute.stops.includes(fsid)
          );
          const joinEndCommonStops = toRoute.stops.filter((tsid) =>
            joinRoute.stops.includes(tsid)
          );

          // check if there is common stops
          if (
            joinStartCommonStops.length === 0 ||
            joinEndCommonStops.length === 0
          ) {
            continue joinRoute;
          }

          const routeId = `${fromRoute.route_id} - ${joinRoute.route_id} - ${toRoute.route_id}`;

          const commonStartStop = this.stops.find(
            (stop) => stop.id === joinStartCommonStops.at(-1)
          ) as IStop;

          const commonEndStop = this.stops.find(
            (stop) => stop.id === joinEndCommonStops.at(-1)
          ) as IStop;

          const startCommonStops = this.stops.filter(
            (stop) =>
              stop.name.en === commonStartStop.name.en &&
              stop.road.en === commonStartStop.road.en &&
              stop.township.en === commonStartStop.township.en
          );

          const endCommonStops = this.stops.filter(
            (stop) =>
              stop.name.en === commonEndStop.name.en &&
              stop.road.en === commonEndStop.road.en &&
              stop.township.en === commonEndStop.township.en
          );

          const fromInBetweenStops = StopModelHelper.findInBetweenStops(
            this.from,
            startCommonStops,
            fromRoute.stops.map(
              (s) => this.stops.find((stop) => stop.id === s) as IStop
            )
          );

          const joinInBetweenStops = StopModelHelper.findInBetweenStops(
            startCommonStops,
            endCommonStops,
            joinRoute.stops.map(
              (s) => this.stops.find((stop) => stop.id === s) as IStop
            )
          );

          const toInBetweenStops = StopModelHelper.findInBetweenStops(
            endCommonStops,
            this.to,
            toRoute.stops.map(
              (s) => this.stops.find((stop) => stop.id === s) as IStop
            )
          );

          const fromStop = this.stops.find(
            (stop) => stop.id === fromInBetweenStops.at(-1)?.id
          ) as IStop;

          const toStop = this.stops.find(
            (stop) => stop.id === toInBetweenStops.at(-1)?.id
          ) as IStop;

          // start point
          const startPoint = point([fromStop.lng, fromStop.lat], fromStop, {
            id: fromStop.id,
          });
          // end point
          const endPoint = point([toStop.lng, toStop.lat], toStop, {
            id: toStop.id,
          });

          // geojson
          const commonStartStopPoint = point([
            commonStartStop.lng,
            commonStartStop.lat,
          ]);
          const commonEndStopPoint = point([
            commonEndStop.lng,
            commonEndStop.lat,
          ]);

          const joinRouteLineString = createLineString(
            joinRoute.coordinates,
            joinRoute.route_id
          );

          const fromRouteLineSlice = createLineSlice(
            startPoint,
            commonStartStopPoint,
            fromRouteLineString,
            routeId
          );

          const joinRouteLineSlice = createLineSlice(
            commonStartStopPoint,
            commonEndStopPoint,
            joinRouteLineString,
            routeId
          );

          const toRouteLineSlice = createLineSlice(
            commonEndStopPoint,
            endPoint,
            toRouteLineString,
            routeId
          );

          const fromRouteLength = length(fromRouteLineSlice, {
            units: this.distanceUnit,
          });

          const joinRouteLength = length(joinRouteLineSlice, {
            units: this.distanceUnit,
          });

          const toRouteLength = length(toRouteLineSlice, {
            units: this.distanceUnit,
          });

          // push to array
          this._transitRoutes.push({
            id: routeId,
            routes: [
              {
                ...fromRoute,
                stops: fromInBetweenStops.map((stop) => stop.id),
                coordinates: fromRouteLineSlice.geometry.coordinates.map(
                  ([lng, lat]) => ({
                    lng,
                    lat,
                  })
                ),
              },
              {
                ...joinRoute,
                stops: joinInBetweenStops.map((stop) => stop.id),
                coordinates: joinRouteLineSlice.geometry.coordinates.map(
                  ([lng, lat]) => ({
                    lng,
                    lat,
                  })
                ),
              },
              {
                ...toRoute,
                stops: toInBetweenStops.map((stop) => stop.id),
                coordinates: toRouteLineSlice.geometry.coordinates.map(
                  ([lng, lat]) => ({
                    lng,
                    lat,
                  })
                ),
              },
            ],
            transitSteps: [
              {
                type: TransitType.TRANSIT,
                step: omit(fromRoute, ["stops", "coordinates"]),
                distance: fromRouteLength,
              },
              {
                type: TransitType.TRANSIT,
                step: omit(joinRoute, ["stops", "coordinates"]),
                distance: joinRouteLength,
              },
              {
                type: TransitType.TRANSIT,
                step: omit(toRoute, ["stops", "coordinates"]),
                distance: toRouteLength,
              },
            ],
            distance: fromRouteLength + joinRouteLength + toRouteLength,
          });
        }
      }
    }
  }

  public static sortTransitRoutes(routes: ITransitRoute[]): ITransitRoute[] {
    return routes.sort((prev, next) => {
      // prioritize the routes with fewer transit steps
      if (prev.transitSteps.length < next.transitSteps.length) {
        return -1;
      } else if (prev.transitSteps.length > next.transitSteps.length) {
        return 1;
      } else {
        const prevStops = prev.routes.flatMap((r) => r.stops);
        const nextStops = next.routes.flatMap((r) => r.stops);

        // if transit steps are equal, prioritize by stops
        if (prevStops.length < nextStops.length) {
          return -1;
        } else if (prevStops.length > nextStops.length) {
          return 1;
        } else {
          return 0;
        }
      }
    });
  }
}
