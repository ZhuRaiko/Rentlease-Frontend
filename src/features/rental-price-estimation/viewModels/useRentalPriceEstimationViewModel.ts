import { useEffect, useRef, useState } from 'react';

import { normalizeError } from '../../../shared/errors/AppError';
import type { AsyncState } from '../../../shared/models/AsyncState';
import {
  estimatePropertyPreviews,
  previewRentalEstimate,
  type EstimateActor,
  type EstimatePropertyPreview,
  type RentalPriceEstimate,
  type RentalPriceEstimationScreen,
} from '../models/RentalPriceEstimate';

export function useRentalPriceEstimationViewModel(actor: EstimateActor) {
  const [screen, setScreen] = useState<RentalPriceEstimationScreen>('introduction');
  const [history, setHistory] = useState<RentalPriceEstimationScreen[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    estimatePropertyPreviews[0]?.id ?? '',
  );
  const [estimateState, setEstimateState] = useState<AsyncState<RentalPriceEstimate>>({
    status: 'idle',
    data: null,
    error: null,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedProperty =
    estimatePropertyPreviews.find((property) => property.id === selectedPropertyId) ??
    estimatePropertyPreviews[0];

  useEffect(
    () => () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    },
    [],
  );

  const navigate = (nextScreen: RentalPriceEstimationScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setHistory((current) => {
      const previous = current.at(-1) ?? 'introduction';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const selectProperty = (property: EstimatePropertyPreview) => {
    setSelectedPropertyId(property.id);
    navigate('propertyReview');
  };

  const completePreviewEstimate = () => {
    if (!selectedProperty) return;
    const isStudio = selectedProperty.id === 'estimate-dasma-studio';
    const estimatedMonthlyRent = isStudio ? 17_600 : previewRentalEstimate.estimatedMonthlyRent;
    const suggestedMinimum = isStudio ? 15_800 : previewRentalEstimate.suggestedMinimum;
    const suggestedMaximum = isStudio ? 19_400 : previewRentalEstimate.suggestedMaximum;
    const differenceAmount = Math.abs(selectedProperty.askingRent - estimatedMonthlyRent);
    const estimate: RentalPriceEstimate = {
      ...previewRentalEstimate,
      propertyId: selectedProperty.id,
      estimatedMonthlyRent,
      suggestedMinimum,
      suggestedMaximum,
      askingRent: selectedProperty.askingRent,
      differenceAmount,
      differencePercent: Number(((differenceAmount / estimatedMonthlyRent) * 100).toFixed(1)),
      comparison:
        selectedProperty.askingRent < suggestedMinimum
          ? 'below-range'
          : selectedProperty.askingRent > suggestedMaximum
            ? 'above-range'
            : 'within-range',
    };
    setEstimateState({ status: 'success', data: estimate, error: null });
    setScreen(actor === 'landlord' ? 'landlordResult' : 'tenantComparison');
    setNotice('Presentation-only estimate. No FastAPI request was sent.');
    previewTimer.current = null;
  };

  const requestEstimate = () => {
    if (!selectedProperty?.estimateAvailable || selectedProperty.landArea === null) {
      navigate('unavailable');
      return;
    }
    setHistory((current) => [...current, screen]);
    setScreen('loading');
    setEstimateState({ status: 'loading', data: null, error: null });
    setNotice(null);
    previewTimer.current = setTimeout(completePreviewEstimate, 900);
  };

  const retryEstimate = () => {
    setHistory((current) => [...current, screen]);
    setScreen('loading');
    setEstimateState({ status: 'loading', data: estimateState.data, error: null });
    previewTimer.current = setTimeout(completePreviewEstimate, 900);
  };

  const showErrorPreview = () => {
    setEstimateState({
      status: 'error',
      data: estimateState.data,
      error: normalizeError(
        new Error('The estimator could not be reached. Check your connection and try again.'),
      ),
    });
    navigate('error');
  };

  const showUnavailablePreview = () => navigate('unavailable');

  return {
    backFromWorkspace: (onClose: () => void) => { if (screen === 'introduction') onClose(); else goBack(); },
    actor,
    screen,
    estimateState,
    notice,
    properties: estimatePropertyPreviews,
    selectedProperty,
    navigate,
    goBack,
    selectProperty,
    requestEstimate,
    retryEstimate,
    showErrorPreview,
    showUnavailablePreview,
    setNotice,
  };
}

export type RentalPriceEstimationViewModel = ReturnType<
  typeof useRentalPriceEstimationViewModel
>;
