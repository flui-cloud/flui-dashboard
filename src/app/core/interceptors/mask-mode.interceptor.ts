import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { MaskModeService } from '../services/mask-mode.service';

/**
 * Stamps `x-mask-mode: on` while the local toggle is enabled. The backend
 * decides what gets substituted; this makes no decision of its own and never
 * touches the response.
 */
export const maskModeInterceptor: HttpInterceptorFn = (req, next) => {
  const mask = inject(MaskModeService);

  if (!mask.enabled()) return next(req);

  return next(req.clone({ setHeaders: { 'x-mask-mode': 'on' } }));
};
