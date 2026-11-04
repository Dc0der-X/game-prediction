import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AccountService } from './account.service';

/** Signed-in users only. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AccountService).user$.pipe(
    take(1),
    map((u) => (u ? true : router.createUrlTree(['/login'], { queryParams: { next: state.url } })))
  );
};

/** Trial or paid users only – everyone else goes to the pricing page. */
export const proGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AccountService).access$.pipe(
    take(1),
    map((a) => {
      if (!a.signedIn) return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
      return a.hasPro ? true : router.createUrlTree(['/pro']);
    })
  );
};

/** Admins only. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AccountService).access$.pipe(
    take(1),
    map((a) => (a.isAdmin ? true : router.createUrlTree(['/lobby'])))
  );
};
