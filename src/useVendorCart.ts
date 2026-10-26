import { useCallback, useRef, useState } from "react";
import Storage from "expo-sqlite/kv-store";
import { parts } from "./catalog";
import {
  addToCart,
  decodeCart,
  setCartQuantity,
  type CartLine,
  type Vendor,
} from "./cart";
const key = "pit-finder.vendor-carts.v1";
export function useVendorCart() {
  const [initial] = useState(() => {
    try {
      return {
        cart: decodeCart(
          Storage.getItemSync(key),
          new Set(parts.map((p) => p.id)),
        ),
        error: "",
      };
    } catch {
      return {
        cart: [] as CartLine[],
        error:
          "Saved carts could not be loaded. Existing saved data has not been replaced.",
      };
    }
  });
  const [cart, setCart] = useState(initial.cart);
  const [storageError, setStorageError] = useState(initial.error);
  const current = useRef(cart);
  const update = useCallback((next: CartLine[]) => {
    try {
      Storage.setItemSync(key, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Changes are available this session but could not be saved on this device.",
      );
    }
    current.current = next;
    setCart(next);
  }, []);
  const add = useCallback(
    (vendor: Vendor, partId: string) =>
      update(addToCart(current.current, vendor, partId)),
    [update],
  );
  const quantity = useCallback(
    (vendor: Vendor, partId: string, count: number) =>
      update(setCartQuantity(current.current, vendor, partId, count)),
    [update],
  );
  return { cart, add, quantity, storageError };
}
