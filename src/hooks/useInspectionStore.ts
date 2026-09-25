// 状态层：用 React 的 useSyncExternalStore 维护单一本地存档，
// 每次变更都通过 storage 层写回 localStorage；界面组件只消费这里暴露的接口。

import { useCallback, useRef, useSyncExternalStore } from "react";
import type {
  ArchiveData,
  MeasurementInput,
  Stop,
  StopCategory,
  Venue,
  VenueKind,
} from "../types";
import {
  createStopId,
  createVenueId,
  pipeIdOf,
  resolveRecheck,
  upsertMeasurement,
} from "../domain/inspection";
import { loadArchive, saveArchive } from "../storage/archive";

let archive: ArchiveData = loadArchive();
const listeners = new Set<() => void>();

function emit() {
  saveArchive(archive);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ArchiveData {
  return archive;
}

export function useInspectionStore() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ref = useRef(data);
  ref.current = data;

  const saveMeasurement = useCallback(
    (venueId: string, stopId: string, input: MeasurementInput) => {
      const result = upsertMeasurement(ref.current.pipes, venueId, stopId, input, new Date().toISOString());
      archive = { ...ref.current, pipes: result.pipes };
      emit();
      return result;
    },
    [],
  );

  const resolvePipe = useCallback((pipeId: string) => {
    archive = { ...ref.current, pipes: resolveRecheck(ref.current.pipes, pipeId, new Date().toISOString()) };
    emit();
  }, []);

  const deletePipe = useCallback((pipeId: string) => {
    archive = { ...ref.current, pipes: ref.current.pipes.filter((p) => p.id !== pipeId) };
    emit();
  }, []);

  const addVenue = useCallback((name: string, kind: VenueKind): Venue => {
    const venue: Venue = { id: createVenueId(), name: name.trim(), kind };
    archive = { ...ref.current, venues: [...ref.current.venues, venue] };
    emit();
    return venue;
  }, []);

  const addStop = useCallback((venueId: string, name: string, category: StopCategory): Stop => {
    const stop: Stop = { id: createStopId(), venueId, name: name.trim(), category };
    archive = { ...ref.current, stops: [...ref.current.stops, stop] };
    emit();
    return stop;
  }, []);

  return {
    venues: data.venues,
    stops: data.stops,
    pipes: data.pipes,
    pipeIdOf,
    saveMeasurement,
    resolvePipe,
    deletePipe,
    addVenue,
    addStop,
  };
}
