import { describe, it, expect } from "vitest";
import {
  photonAddresses,
  yandexAddresses,
  validDeliveryPoint,
} from "../shared/delivery-location";
describe("delivery geocoding", () => {
  it("keeps longitude and latitude in their correct order and filters foreign or invalid points", () => {
    const feature = {
      geometry: { coordinates: [27.5, 53.91] },
      properties: {
        countrycode: "BY",
        city: "Минск",
        street: "улица Притыцкого",
        housenumber: "10",
      },
    };
    const addresses = photonAddresses({
      features: [
        feature,
        feature,
        {
          ...feature,
          properties: { ...feature.properties, countrycode: "RU" },
        },
        { ...feature, geometry: { coordinates: [200, NaN] } },
      ],
    });
    expect(addresses).toEqual([
      {
        lat: 53.91,
        lon: 27.5,
        label: "Минск, улица Притыцкого, 10",
        precise: true,
      },
    ]);
    expect(photonAddresses(null)).toEqual([]);
    expect(validDeliveryPoint("53.9", 27.5)).toBe(false);
  });
  it("distinguishes a street point from a house address", () => {
    expect(
      photonAddresses({
        features: [
          {
            geometry: { coordinates: [27.5, 53.91] },
            properties: {
              countrycode: "BY",
              city: "Минск",
              street: "улица Притыцкого",
            },
          },
        ],
      })[0]?.precise,
    ).toBe(false);
  });
  it("parses exact and approximate Yandex addresses without inventing house accuracy", () => {
    const obj = {
      Point: { pos: "27.5006199 53.9111735" },
      metaDataProperty: {
        GeocoderMetaData: {
          kind: "house",
          precision: "exact",
          Address: {
            country_code: "BY",
            formatted: "Минск, улица Притыцкого, 10",
          },
        },
      },
    };
    const data = {
      response: {
        GeoObjectCollection: { featureMember: [{ GeoObject: obj }] },
      },
    };
    expect(yandexAddresses(data)[0]).toEqual({
      lat: 53.9111735,
      lon: 27.5006199,
      label: "Минск, улица Притыцкого, 10",
      precise: true,
    });
    obj.metaDataProperty.GeocoderMetaData.precision = "street";
    expect(yandexAddresses(data)[0]?.precise).toBe(false);
    expect(yandexAddresses({})).toEqual([]);
  });
});
