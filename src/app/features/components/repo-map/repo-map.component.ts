import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader,
  lucideRefreshCw,
  lucideCircleCheck,
  lucideCircleX,
  lucideCircleAlert,
  lucideTriangleAlert,
  lucideCircleHelp,
  lucideKey,
  lucideChevronDown,
  lucideChevronRight,
  lucideGitBranch,
  lucideRocket,
  lucideGitCommitHorizontal,
} from '@ng-icons/lucide';

import { AppliedUnit, RepoMapService } from '../../service/repo-map.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { ClusterStatus } from '../../model/cluster.models';

import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  RepoMapSurfaceInput,
  RepoMapSurfaceRevision,
  buildRepoMapSurface,
  presentedContent as repoMapPresentedContent,
} from './repo-map-surface';

import { VerdictDto } from '../../../core/api/model/verdictDto';
import { RenderedUnitDto } from '../../../core/api/model/renderedUnitDto';


/** Every field the generator typed as bare `object` because the OpenAPI spec left it
 * `nullable: true` with no `type` — it is really `string | null` on the wire. */
function str(v: unknown): string {
  return v === null || v === undefined ? '' : (v as string);
}

/** The engine writes paragraphs; this screen shows one sentence of them and nothing else.
 * The full text is a click away in the raw map. */
function firstSentence(text: string): string {
  const whole = (text ?? '').trim();
  const stop = /[.!?](\s|$)/.exec(whole);
  return stop ? whole.slice(0, stop.index + 1) : whole;
}

/** Outcomes that mean something is standing in the way — the card must never be empty under one. */
export const BAD_OUTCOMES = new Set<string>(['blocked', 'insufficient_capacity', 'partial', 'not_assessed']);

/** The verdicts the apply endpoint refuses outright. Deliberately not `BAD_OUTCOMES`: `partial`
 * is a verdict it acts on — the ready units go, the blocked ones are held back — and disabling
 * the button on it would refuse a deploy the backend would have accepted. */
const UNACTIONABLE_OUTCOMES = new Set<string>(['blocked', 'insufficient_capacity', 'not_assessed']);

interface Obstacle {
  summary: string;
  remedy: string;
  unit: string;
}

/** One thing the user has to hand over: a value, or the key that reaches a third party. */
interface NeededThing {
  name: string;
  tags: string[];
  detail: string;
}

@Component({
  selector: 'app-repo-map',
  standalone: true,
  imports: [RouterLink, NgIconComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideLoader,
      lucideRefreshCw,
      lucideCircleCheck,
      lucideCircleX,
      lucideCircleAlert,
      lucideTriangleAlert,
      lucideCircleHelp,
      lucideKey,
      lucideChevronDown,
      lucideChevronRight,
      lucideGitBranch,
      lucideRocket,
      lucideGitCommitHorizontal,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto p-6 space-y-5">
      <!-- Header -->
      <div class="flex items-end justify-between gap-4">
        <div>
          <a
            routerLink="/apps/repositories"
            class="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mb-1"
          >
            <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
            Repositories
          </a>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
            {{ repo()?.fullName ?? 'Deploy readiness' }}
          </h1>
        </div>
        @if (result()?.read?.commitSha) {
          <span class="text-xs font-mono text-slate-400 dark:text-slate-500">
            commit {{ shortSha(result()!.read.commitSha!) }}
          </span>
        }
      </div>

      <!-- Controls -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Branch</label>
          <div class="relative">
            <ng-icon name="lucideGitBranch" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none z-10" />
            @if (branches().length > 0) {
              <select
                [value]="branchInput()"
                (change)="branchInput.set($any($event.target).value)"
                class="pl-7 pr-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white min-w-[10rem] max-w-[16rem]"
              >
                @for (b of branches(); track b.name) {
                  <option [value]="b.name" [selected]="b.name === branchInput()">{{ b.name }}</option>
                }
              </select>
            } @else {
              <input
                type="text"
                [value]="branchInput()"
                (input)="branchInput.set($any($event.target).value)"
                [placeholder]="repo()?.branch || 'default branch'"
                class="pl-7 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-40"
              />
            }
          </div>
          @if (branchesError()) {
            <p class="mt-1 text-xs text-amber-700 dark:text-amber-400 max-w-[16rem]">
              Branches could not be listed — type one, or leave it empty for the repository's default.
            </p>
          }
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cluster</label>
          <select
            [value]="clusterIdInput()"
            (change)="clusterIdInput.set($any($event.target).value)"
            class="py-1.5 px-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white min-w-[12rem]"
          >
            <!-- Binding value on the select alone does not hold: the options arrive after it is
                 applied, so the control showed one branch and one cluster while the button acted
                 on another — measured live, with the page declaring "Any" over a deploy that had a
                 cluster. A selected binding is evaluated when the option is created, so it holds. -->
            <option value="" [selected]="clusterIdInput() === ''">Choose a cluster</option>
            @for (c of activeClusters(); track c.id) {
              <option [value]="c.id" [selected]="c.id === clusterIdInput()">{{ c.name || c.id }}</option>
            }
          </select>
        </div>
        <button
          (click)="runMap()"
          [disabled]="loading()"
          class="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60"
        >
          <ng-icon [name]="loading() ? 'lucideLoader' : 'lucideRefreshCw'" class="h-4 w-4" [class.animate-spin]="loading()" />
          {{ hasRun() ? 'Check again' : 'Check' }}
        </button>
      </div>

      @if (error()) {
        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p class="text-sm text-red-900 dark:text-red-200">{{ error() }}</p>
        </div>
      }

      @if (loading() && !result()) {
        <div class="flex items-center justify-center py-16">
          <ng-icon name="lucideLoader" class="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }

      @if (result(); as r) {
        @if (!r.read.ok) {
          <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-5">
            <div class="flex items-center gap-2">
              <ng-icon name="lucideCircleX" class="h-5 w-5 text-red-600 dark:text-red-400" />
              <h2 class="text-base font-semibold text-red-900 dark:text-red-200">This repository could not be read</h2>
            </div>
            <p class="mt-1 text-sm text-red-800 dark:text-red-300">
              <span class="font-mono">{{ r.read.reason || 'unknown' }}</span> — branch
              <span class="font-mono">{{ r.branch }}</span>
            </p>
          </div>
        } @else {

          <!-- 1. Can this be deployed? -->
          <section class="rounded-xl border p-5" [class]="outcomeCardClasses()">
            <div class="flex items-center gap-2">
              <ng-icon [name]="outcomeIcon()" class="h-6 w-6 flex-shrink-0" />
              <h2 class="text-lg font-bold">{{ outcomeLabel() }}</h2>
            </div>
            <p class="mt-1 text-sm">{{ verdictHeadline(r.verdict) }}</p>
            @if (capacityLine(r.verdict); as line) {
              <p class="mt-1 text-sm opacity-90">{{ line }}</p>
            }
          </section>

          <!-- 2. What is needed from the user -->
          <section class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ng-icon name="lucideKey" class="h-5 w-5 text-slate-400" />
              What you need to provide
            </h2>
            @if (needed(); as list) {
              @if (list.length === 0) {
                <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">No environment values or keys are needed.</p>
              } @else {
                <ul class="mt-3 space-y-2">
                  @for (n of list; track n.name) {
                    <li class="flex flex-wrap items-center gap-2 text-sm">
                      <span class="font-mono text-slate-900 dark:text-white">{{ n.name }}</span>
                      @for (t of n.tags; track t) {
                        <span class="text-xs px-1.5 py-0.5 rounded" [class]="tagClasses(t)">{{ t }}</span>
                      }
                      @if (n.detail) {
                        <span class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ n.detail }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            }
          </section>

          <!-- 3. What is in the way -->
          @if (obstacles().length > 0) {
            <section class="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-5">
              <h2 class="text-base font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                <ng-icon name="lucideTriangleAlert" class="h-5 w-5" />
                In the way
              </h2>
              <ul class="mt-3 space-y-3">
                @for (o of obstacles(); track $index) {
                  <li>
                    <p class="text-sm text-slate-900 dark:text-slate-100">
                      {{ o.summary }}
                      @if (o.unit) {
                        <span class="font-mono text-xs text-slate-500 dark:text-slate-400">({{ o.unit }})</span>
                      }
                    </p>
                    @if (o.remedy) {
                      <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                        <span class="font-medium">Fix:</span> {{ o.remedy }}
                      </p>
                    }
                  </li>
                }
              </ul>
            </section>
          }

          <!-- Uncertainty stays a question — never a blank field, never a green tick -->
          @if (questions(); as qs) {
            @if (qs.length > 0) {
              <section class="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/10 p-5">
                <h2 class="text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <ng-icon name="lucideCircleHelp" class="h-5 w-5" />
                  We could not tell
                </h2>
                <ul class="mt-3 space-y-2">
                  @for (q of qs; track q.id) {
                    <li class="text-sm text-slate-900 dark:text-slate-100">
                      {{ q.question }}
                      @if (q.options.length > 0) {
                        <span class="ml-1 inline-flex flex-wrap gap-1 align-middle">
                          @for (opt of shortOptions(q.options); track opt) {
                            <span class="text-xs font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/20 text-slate-600 dark:text-slate-300">{{ opt }}</span>
                          }
                          @if (longOptionCount(q.options) > 0) {
                            <span class="text-xs text-slate-500 dark:text-slate-400">
                              {{ longOptionCount(q.options) }} more in the raw map
                            </span>
                          }
                        </span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
          }

          <!-- What would run -->
          <section class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">What would run</h2>
            <ul class="mt-3 space-y-1.5 text-sm">
              @for (u of r.map!.units; track u.id) {
                <li class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-slate-900 dark:text-white">{{ unitName(u.id) }}</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">{{ u.build.strategy }}</span>
                  @if (u.port) {
                    <span class="text-xs font-mono text-slate-500 dark:text-slate-400">:{{ u.port.value }}</span>
                  }
                  <span class="text-xs px-1.5 py-0.5 rounded" [class]="readinessClasses(readinessOf(r.verdict, u.id))">
                    {{ readinessLabel(readinessOf(r.verdict, u.id)) }}
                  </span>
                  @if (skippedUnitIds().has(u.id)) {
                    <span class="text-xs text-amber-700 dark:text-amber-400">not in the flui.yaml</span>
                  }
                </li>
              }
              @for (s of r.map!.services; track $index) {
                <li class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-slate-700 dark:text-slate-300">{{ s.name }}</span>
                  @if (s.block) {
                    <span class="text-xs text-slate-500 dark:text-slate-400">{{ s.block }}</span>
                  } @else {
                    <span class="text-xs text-red-700 dark:text-red-400">no block</span>
                  }
                </li>
              }
            </ul>
          </section>

          <!-- 4. The next step -->
          <section class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            @if (applied(); as done) {

              <div class="flex items-center gap-2">
                <ng-icon
                  [name]="done.partial ? 'lucideTriangleAlert' : 'lucideCircleCheck'"
                  class="h-5 w-5"
                  [class]="done.partial ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'"
                />
                <h2 class="text-base font-bold text-slate-900 dark:text-white">
                  {{ done.partial ? 'Applied, but not everything was armed' : 'Applied' }}
                </h2>
              </div>

              <!-- An unarmed unit that could not even be marked is the one thing on this screen
                   that costs money if it is missed: the next apply creates a second one beside it. -->
              @if (unmarkedUnits(); as unmarked) {
                @if (unmarked.length > 0) {
                  <div class="mt-3 rounded-lg border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20 p-4">
                    <p class="text-sm font-bold text-red-900 dark:text-red-200">
                      {{ unmarked.length }} application{{ unmarked.length === 1 ? '' : 's' }} could not be
                      marked for reuse.
                    </p>
                    <p class="mt-1 text-sm text-red-800 dark:text-red-300">
                      The next apply of this repository will not recognise
                      {{ unmarked.length === 1 ? 'it' : 'them' }} and will create a second application
                      beside {{ unmarked.length === 1 ? 'it' : 'each of them' }} — with a second database
                      if this one attached any. Remove {{ unmarked.length === 1 ? 'it' : 'them' }} by hand
                      first.
                    </p>
                    <ul class="mt-2 space-y-1">
                      @for (u of unmarked; track u.unitId) {
                        <li class="text-sm">
                          <a
                            [routerLink]="['/apps/applications', u.applicationId]"
                            class="font-medium text-red-900 dark:text-red-200 underline"
                          >{{ u.name }}</a>
                          <span class="ml-2 text-xs font-mono text-red-700 dark:text-red-400">{{ u.slug }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
              }

              <p class="mt-3 text-sm text-slate-700 dark:text-slate-300">
                <ng-icon name="lucideGitBranch" class="h-3.5 w-3.5 inline-block align-middle text-slate-400" />
                <a
                  [href]="done.branchUrl"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-blue-700 dark:text-blue-400 hover:underline"
                >{{ done.branch }}</a>
                <ng-icon name="lucideGitCommitHorizontal" class="ml-2 h-3.5 w-3.5 inline-block align-middle text-slate-400" />
                <a
                  [href]="done.commitUrl"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-blue-700 dark:text-blue-400 hover:underline"
                >{{ shortSha(done.commitSha) }}</a>
                <span class="ml-2 text-slate-500 dark:text-slate-400">
                  cut from {{ done.baseBranch }}, which was not written to.
                </span>
              </p>

              <ul class="mt-3 space-y-2">
                @for (u of done.units; track u.unitId) {
                  <li>
                    <div class="flex flex-wrap items-center gap-2 text-sm">
                      <a
                        [routerLink]="['/apps/applications', u.applicationId]"
                        class="font-medium text-blue-700 dark:text-blue-400 hover:underline"
                      >{{ u.name }}</a>
                      <span class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ u.slug }}</span>
                      <span
                        class="text-xs px-1.5 py-0.5 rounded"
                        [class]="u.armed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'"
                      >{{ u.armed ? 'building' : 'not armed' }}</span>
                      @if (u.workflowRunUrl) {
                        <a
                          [href]="u.workflowRunUrl"
                          target="_blank"
                          rel="noopener"
                          class="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                        >build run</a>
                      }
                    </div>
                    @if (!u.armed && u.reason) {
                      <p class="mt-0.5 text-sm text-amber-800 dark:text-amber-300">{{ u.reason }}</p>
                    }
                  </li>
                }
              </ul>

              @if (done.skipped.length > 0) {
                <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Nothing was committed for
                  @for (s of done.skipped; track s.unitId) {
                    <span class="font-mono">{{ unitName(s.unitId) }}</span
                    >{{ $last ? '' : ', ' }}
                  }
                  — {{ done.skipped[0].reason }}
                </p>
              }

              <div class="mt-3 flex flex-wrap items-center gap-4 text-xs">
                <button
                  (click)="toggle('files')"
                  class="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:underline"
                >
                  <ng-icon [name]="isExpanded('files') ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-3.5 w-3.5" />
                  {{ done.files.length }} file{{ done.files.length === 1 ? '' : 's' }} written
                </button>
              </div>
              @if (isExpanded('files')) {
                <ul class="mt-2 space-y-0.5">
                  @for (f of done.files; track f) {
                    <li class="text-xs font-mono text-slate-600 dark:text-slate-400">{{ f }}</li>
                  }
                </ul>
              }

            } @else {

              <p class="text-sm text-slate-700 dark:text-slate-300">
                This writes a branch and a commit to your repository, and builds on your Actions minutes.
              </p>
              <button
                (click)="toggle('apply-detail')"
                class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <ng-icon [name]="isExpanded('apply-detail') ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-3.5 w-3.5" />
                exactly what it does
              </button>
              @if (isExpanded('apply-detail')) {
                <div class="mt-1.5 space-y-1.5 border-l-2 border-slate-200 dark:border-slate-700 pl-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <p>
                    Flui cuts <span class="font-mono">flui/deploy-{{ shortSha(r.read.commitSha || '') }}</span>
                    from <span class="font-mono">{{ r.branch }}</span> and puts one commit on it with the
                    flui.yaml below and one workflow per unit. Your own branch is only read.
                  </p>
                  <p>
                    Each unit then builds on GitHub Actions — {{ renderedUnits().length }}
                    build{{ renderedUnits().length === 1 ? '' : 's' }}, on your minutes — and deploys.
                  </p>
                  <p>
                    It also creates {{ renderedUnits().length }}
                    application{{ renderedUnits().length === 1 ? '' : 's' }} in Flui. If the apply fails
                    halfway they stay: Flui never removes an application on its own, and it tells you
                    which ones are there.
                  </p>
                  @if (r.map!.services.length > 0) {
                    <p>
                      The {{ r.map!.services.length }} service{{ r.map!.services.length === 1 ? '' : 's' }}
                      this repository declares
                      {{ r.map!.services.length === 1 ? 'is' : 'are' }} installed from the catalog before
                      anything is committed, and stay if the apply fails.
                    </p>
                  }
                </div>
              }

              <!-- The reason rides on the wrapper, not the button: a disabled button receives no
                   pointer events, so a title on it never shows. -->
              <!-- inline-block let this sit on the same line as the disclosure toggle above, and
                   the blue button covered its label. The wrapper is what carries the title, so it
                   stays — as a block. -->
              <span class="mt-3 block" [title]="applyBlockedReason()">
                <button
                  type="button"
                  (click)="apply()"
                  [disabled]="applyDisabled()"
                  [attr.aria-disabled]="applyDisabled()"
                  [attr.aria-label]="applyBlockedReason() || null"
                  [class]="applyDisabled()
                    ? 'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700/60 text-slate-500 dark:text-slate-500 text-sm font-semibold cursor-not-allowed'
                    : 'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold'"
                >
                  <ng-icon
                    [name]="applying() ? 'lucideLoader' : 'lucideRocket'"
                    class="h-4 w-4"
                    [class.animate-spin]="applying()"
                  />
                  {{ applying() ? 'Applying…' : 'Deploy from this map' }}
                </button>
              </span>

              <!-- The reason a dead button is dead has to be readable, not only announced. It lived
                   in the title and aria-label alone: on the live page a green "Ready to deploy"
                   banner sat above a grey button with no word anywhere saying a cluster was still
                   unchosen, and a disabled button receives no pointer events, so the title never
                   came. -->
              @if (!applying() && applyBlockedReason(); as why) {
                <p class="mt-1.5 text-sm text-amber-700 dark:text-amber-400 max-w-prose">{{ why }}</p>
              }

              @if (applying()) {
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Cutting the branch, committing the manifests, and installing the services they declare.
                  This can take a few minutes — leave the page open.
                </p>
              }

            }

            @if (applyRefusal(); as refusal) {
              @if (refusal.stranded; as left) {
                <!-- Not a red row like any other: something exists on the cluster, and only this
                     message says what. -->
                <div class="mt-4 rounded-xl border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20 p-4">
                  <div class="flex items-center gap-2">
                    <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
                    <h3 class="text-base font-bold text-red-900 dark:text-red-200">
                      The apply failed and left something behind
                    </h3>
                  </div>
                  <p class="mt-2 text-sm text-red-900 dark:text-red-200 whitespace-pre-wrap">{{ refusal.message }}</p>
                  @if (left.applications.length > 0) {
                    <ul class="mt-3 space-y-1">
                      @for (a of left.applications; track a.applicationId) {
                        <li class="text-sm">
                          <a
                            [routerLink]="['/apps/applications', a.applicationId]"
                            class="font-medium text-red-900 dark:text-red-200 underline"
                          >{{ a.name }}</a>
                          <span class="ml-2 text-xs font-mono text-red-700 dark:text-red-400">{{ a.slug }}</span>
                          @if (a.attachedServices.length > 0) {
                            <span class="ml-2 text-xs text-red-700 dark:text-red-400">
                              with {{ a.attachedServices.join(', ') }}
                            </span>
                          }
                        </li>
                      }
                    </ul>
                  }
                </div>
              } @else {
                <div class="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
                  <p class="text-sm text-red-900 dark:text-red-200 whitespace-pre-wrap">{{ refusal.message }}</p>
                </div>
              }
            }

            <div class="mt-3 flex flex-wrap items-center gap-4 text-xs">
              @if (renderedUnits().length > 0) {
                <button
                  (click)="toggle('yaml')"
                  class="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <ng-icon [name]="isExpanded('yaml') ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-3.5 w-3.5" />
                  flui.yaml
                </button>
              }
              <button
                (click)="toggle('raw')"
                class="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:underline"
              >
                <ng-icon [name]="isExpanded('raw') ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-3.5 w-3.5" />
                raw map
              </button>
              @if (r.map!.caveats.length > 0) {
                <span class="text-slate-400 dark:text-slate-500">
                  {{ r.map!.caveats.length }} note{{ r.map!.caveats.length === 1 ? '' : 's' }} in the raw map
                </span>
              }
            </div>

            @if (isExpanded('yaml')) {
              <div class="mt-3 space-y-3">
                @for (ru of renderedUnits(); track ru.unitId) {
                  <div>
                    <p class="text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">{{ unitName(ru.unitId) }}</p>
                    <pre class="text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto">{{ ru.yaml }}</pre>
                  </div>
                }
              </div>
            }
            @if (isExpanded('raw')) {
              <pre class="mt-3 text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-96 overflow-y-auto leading-5">{{ rawJson() }}</pre>
            }
          </section>
        }
      }
    </div>
  `,
})
export class RepoMapComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repoMapService = inject(RepoMapService);
  private readonly repoService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);

  private readonly repositoryId = signal<string>('');
  readonly branchInput = signal('');
  readonly clusterIdInput = signal('');
  readonly hasRun = signal(false);

  readonly result = this.repoMapService.map;
  readonly branches = this.repoMapService.branches;
  readonly branchesError = this.repoMapService.branchesError;
  readonly loading = this.repoMapService.loading;
  readonly error = this.repoMapService.error;
  readonly applying = this.repoMapService.applying;
  readonly applied = this.repoMapService.applyResult;
  readonly applyRefusal = this.repoMapService.applyRefusal;

  /** The (branch, cluster) pair the map on screen was read for. The apply is refused on a verdict
   * that is a function of exactly that pair, so a picker changed without checking again would
   * send the user off a verdict they were never shown. */
  private readonly ranWith = signal<{ branch: string; clusterId: string } | null>(null);

  readonly repo = computed(() =>
    this.repoService.repositories().find((r) => r.id === this.repositoryId()) ?? null
  );

  readonly activeClusters = computed(() =>
    this.clusterService.clusters().filter((c) => c.status === ClusterStatus.ACTIVE)
  );

  private readonly expandedKeys = signal<Set<string>>(new Set());

  readonly outcomeLabel = computed(() => {
    switch (this.result()?.verdict.outcome) {
      case VerdictDto.OutcomeEnum.Deployable: return 'Ready to deploy';
      case VerdictDto.OutcomeEnum.DeployablePendingInputs: return 'Ready once you fill in the values below';
      case VerdictDto.OutcomeEnum.Partial: return 'Partly ready';
      case VerdictDto.OutcomeEnum.Blocked: return 'Not deployable yet';
      case VerdictDto.OutcomeEnum.InsufficientCapacity: return 'Too big for this cluster';
      case VerdictDto.OutcomeEnum.NotAssessed: return 'Not assessed';
      default: return 'Unknown';
    }
  });

  readonly outcomeIcon = computed(() => {
    switch (this.result()?.verdict.outcome) {
      case VerdictDto.OutcomeEnum.Deployable: return 'lucideCircleCheck';
      case VerdictDto.OutcomeEnum.DeployablePendingInputs: return 'lucideCircleAlert';
      case VerdictDto.OutcomeEnum.Partial: return 'lucideTriangleAlert';
      case VerdictDto.OutcomeEnum.Blocked: return 'lucideCircleX';
      case VerdictDto.OutcomeEnum.InsufficientCapacity: return 'lucideCircleX';
      default: return 'lucideCircleHelp';
    }
  });

  readonly outcomeCardClasses = computed(() => {
    switch (this.result()?.verdict.outcome) {
      case VerdictDto.OutcomeEnum.Deployable:
        return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100';
      case VerdictDto.OutcomeEnum.DeployablePendingInputs:
        return 'bg-sky-50 dark:bg-sky-900/10 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-100';
      case VerdictDto.OutcomeEnum.Partial:
        return 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100';
      case VerdictDto.OutcomeEnum.Blocked:
      case VerdictDto.OutcomeEnum.InsufficientCapacity:
        return 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100';
      default:
        return 'bg-slate-50 dark:bg-slate-900/10 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100';
    }
  });

  /** The only work the user actually has: values to supply, and the keys that reach a third
   * party Flui does not run. Both are the same act — hand over a value — so they are one list. */
  readonly needed = computed<NeededThing[]>(() => {
    const map = this.result()?.map;
    if (!map) return [];
    const inputs: NeededThing[] = map.inputs.map((i) => ({
      name: i.name,
      tags: [...(i.secret ? ['secret'] : []), ...(i.blocksStart ? ['needed to start'] : [])],
      detail: i.forService ? `for ${i.forService}` : '',
    }));
    const seen = new Set(inputs.map((i) => i.name));
    // An external whose keys the engine could not name is still something the user has to bring.
    // Contributing only through `requires` made Stripe, S3 and SMTP disappear from a card that
    // then said nothing was asked of anyone — measured on the corpus: 21 of 22 maps with
    // externals declare no keys at all. And `ExternalDependencyDto` carries no secret flag, so
    // nothing here may claim one.
    const externals: NeededThing[] = map.externals.flatMap((ext) => {
      const keys = ext.requires.filter((key) => !seen.has(key));
      if (keys.length === 0) {
        return [{ name: ext.name, tags: ['external service'], detail: 'credentials you bring' }];
      }
      return keys.map((key) => ({ name: key, tags: [], detail: `for ${ext.name}` }));
    });
    return [...inputs, ...externals];
  });

  /** Uncertainty is kept as a question, and it loses its paragraphs, not its presence: a unit
   * whose health path could not be determined asks for one here instead of showing an empty
   * field — unless the engine already filed a health question of its own. */
  readonly questions = computed(() => {
    const map = this.result()?.map;
    if (!map) return [];
    const own = map.questions.map((q) => ({
      id: q.id,
      question: firstSentence(q.question),
      options: q.options,
    }));
    // Only where an answer would change something: a unit that declares no port serves nothing, so
    // asking it for a health path is asking about a probe that would have nothing to probe. And the
    // question has to say where the answer goes, or it is a question with no address.
    const health = map.units
      .filter((u) => !u.healthPath && u.port)
      .map((u) => ({
        id: `health:${u.id}`,
        question: `Which path answers a health check for ${this.unitName(u.id)}? Declare it in deploy.healthcheck.path.`,
        options: [] as string[],
      }));
    return [...own, ...health];
  });

  readonly renderedUnits = computed<RenderedUnitDto[]>(() => this.result()?.render?.units ?? []);

  /** Units the render left out. "What would run" listed every unit, including the ones no
   * flui.yaml covers — a unit with no port is skipped by the renderer, and the list said nothing. */
  readonly skippedUnitIds = computed<Set<string>>(
    () => new Set((this.result()?.render?.skipped ?? []).map((s) => str(s.unitId))),
  );

  /** What stands between this repository and a deploy.
   *
   * `map.blockers` is not the only channel that carries a refusal: the verdict has its own gate —
   * no unit renders a manifest, the cluster has no room — and in that case `blockers` is empty and
   * the reason lives only in `verdict.reason`/`verdict.remedy`. Measured on the 81-repository
   * corpus, 20 land exactly there: the old card was hidden, and the screen said "Not deployable
   * yet" with nothing under it and no way to find out why. */
  readonly obstacles = computed<Obstacle[]>(() => {
    const result = this.result();
    const map = result?.map;
    const verdict = result?.verdict;
    if (!map || !verdict) return [];

    const fromBlockers: Obstacle[] = map.blockers.map((b) => ({
      summary: firstSentence(b.summary),
      remedy: firstSentence(b.remedy),
      unit: str(b.unit) ? this.unitName(str(b.unit)) : '',
    }));
    if (fromBlockers.length > 0) return fromBlockers;

    if (BAD_OUTCOMES.has(verdict.outcome)) {
      return [{
        summary: firstSentence(verdict.reason),
        remedy: verdict.remedy ? firstSentence(verdict.remedy) : '',
        unit: '',
      }];
    }
    return [];
  });

  /** Option chips are the engine's own prose arriving through a second door: on the corpus, 163 of
   * 229 options run past eight words and the longest map reached ~1120 visible words that way. A
   * chip is a chip only while it is short. */
  shortOptions(options: string[]): string[] {
    return options.filter((o) => o.trim().split(/\s+/).length <= 4);
  }

  longOptionCount(options: string[]): number {
    return options.length - this.shortOptions(options).length;
  }

  /** Why the apply cannot be pressed, in the order a reader would ask it. Empty means it can. */
  readonly applyBlockedReason = computed<string>(() => {
    const r = this.result();
    if (!r?.read.ok) return 'Check this repository first.';
    // The last attempt left applications that Flui could not mark. Pressing again is exactly what
    // its message says not to do: it would build a second set beside them.
    const left = this.applyRefusal()?.stranded;
    if (left?.markedForReuse === false) {
      return 'The last attempt left applications behind that were not marked for reuse — remove them first, or this builds a second set beside them.';
    }
    if (!this.clusterIdInput().trim()) {
      return 'Pick a cluster above — an apply always deploys onto one.';
    }
    const ran = this.ranWith();
    const moved =
      ran === null ||
      ran.branch !== this.branchInput().trim() ||
      ran.clusterId !== this.clusterIdInput().trim();
    if (moved) {
      return 'The branch or the cluster changed since this map was read — check again first.';
    }
    if (UNACTIONABLE_OUTCOMES.has(r.verdict.outcome)) {
      return `Flui will not apply a map whose verdict is \`${r.verdict.outcome}\`.`;
    }
    if (this.renderedUnits().length === 0) {
      return 'No flui.yaml was rendered, so there is nothing to commit.';
    }
    return '';
  });

  readonly applyDisabled = computed(() => this.applying() || this.applyBlockedReason() !== '');

  /** Units the commit carries that were not armed and that Flui could not even mark: the next
   * apply will not find them and will build a second set beside them. */
  readonly unmarkedUnits = computed<AppliedUnit[]>(() =>
    (this.applied()?.units ?? []).filter((u) => !u.armed && u.markedForReuse === false),
  );

  readonly rawJson = computed(() => JSON.stringify(this.result(), null, 2));

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new RepoMapSurfaceRevision();

  /** What this page is showing, for the Semantic Surface. Every field is read from the same
   * computed the template renders — never a second pass over the map response — so anything the
   * screen filters or trims is inherited here (playbook §5). */
  private readonly surfaceInput = computed<RepoMapSurfaceInput>(() => {
    const r = this.result();
    const needed = this.needed();
    const verdict = r?.verdict;
    const applied = this.applied();
    const refusal = this.applyRefusal();
    const cluster = this.activeClusters().find((c) => c.id === this.clusterIdInput());
    const countReadiness = (readiness: string) =>
      verdict ? verdict.units.filter((u) => u.readiness === readiness).length : 0;

    return {
      repositoryId: this.repositoryId(),
      repoFullName: this.repo()?.fullName,
      branchInput: this.branchInput(),
      branchOptionCount: this.branches().length,
      branchListingFailed: Boolean(this.branchesError()),
      clusterIdInput: this.clusterIdInput(),
      clusterName: cluster?.name,
      hasRun: this.hasRun(),
      loading: this.loading(),
      hasLoadError: Boolean(this.error()),
      read: r ? { branch: r.branch, ok: r.read.ok, reason: r.read.reason, commitShortSha: r.read.commitSha ? this.shortSha(r.read.commitSha) : undefined } : null,
      assessment:
        r?.read.ok && r.map && verdict
          ? {
              coverage: r.map.coverage,
              outcome: verdict.outcome,
              outcomeLabel: this.outcomeLabel(),
              unitsReady: countReadiness('deployable'),
              unitsPendingInputs: countReadiness('deployable_pending_inputs'),
              unitsBlocked: countReadiness('blocked'),
              unitsNotAssessed: countReadiness('not_assessed'),
              capacity: {
                assessed: verdict.capacity.assessed,
                notAssessedReason: verdict.capacity.notAssessedReason,
                known: verdict.capacity.assessment.known,
                fits: verdict.capacity.assessment.fits,
                requiredCpuMillicores: verdict.capacity.assessment.requiredCpuMillicores,
                requiredMemoryMebibytes: verdict.capacity.assessment.requiredMemoryMebibytes,
                availableCpuMillicores: verdict.capacity.assessment.availableCpuMillicores,
                availableMemoryMebibytes: verdict.capacity.assessment.availableMemoryMebibytes,
                uncountedCount: verdict.capacity.uncounted.length,
              },
              neededCount: needed.length,
              neededSecretCount: needed.filter((n) => n.tags.includes('secret')).length,
              neededBlocksStartCount: needed.filter((n) => n.tags.includes('needed to start')).length,
              externalCount: needed.filter((n) => n.tags.includes('external service')).length,
              obstacles: this.obstacles().map((o) => ({ hasRemedy: Boolean(o.remedy), unit: o.unit })),
              questionCount: this.questions().length,
              questionsWithOptionsCount: this.questions().filter((q) => q.options.length > 0).length,
              units: r.map.units.map((u) => ({
                id: u.id,
                name: this.unitName(u.id),
                buildStrategy: u.build.strategy,
                port: u.port?.value ?? null,
                readiness: this.readinessOf(verdict, u.id),
                skipped: this.skippedUnitIds().has(u.id),
              })),
              services: r.map.services.map((s) => ({ name: s.name, block: s.block })),
              renderedUnitCount: this.renderedUnits().length,
              caveatCount: r.map.caveats.length,
            }
          : null,
      yamlExpanded: this.isExpanded('yaml'),
      rawMapExpanded: this.isExpanded('raw'),
      applying: this.applying(),
      applyBlockedReason: this.applyBlockedReason(),
      applied: applied
        ? {
            partial: applied.partial,
            branch: applied.branch,
            commitShortSha: this.shortSha(applied.commitSha),
            baseBranch: applied.baseBranch,
            fileCount: applied.files.length,
            skippedCount: applied.skipped.length,
            units: applied.units,
            unmarkedCount: this.unmarkedUnits().length,
          }
        : null,
      refusal: refusal
        ? {
            status: refusal.status,
            stranded: refusal.stranded
              ? {
                  branchDeleted: refusal.stranded.branchDeleted,
                  committed: refusal.stranded.committed,
                  markedForReuse: refusal.stranded.markedForReuse,
                  applications: refusal.stranded.applications,
                }
              : null,
          }
        : null,
    };
  });

  readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildRepoMapSurface(input, {
      revision: this.surfaceRevision.next(repoMapPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    // Publish this page's snapshot whenever it changes; ngOnDestroy clears it so it never
    // outlives the page it describes.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.repositoryId.set(id);

    const qp = this.route.snapshot.queryParamMap;
    const qBranch = qp.get('branch');
    const qCluster = qp.get('clusterId');
    if (qCluster) this.clusterIdInput.set(qCluster);

    void (async () => {
      if (this.repoService.repositories().length === 0) {
        try { await this.repoService.loadRepositories(); } catch { /* surfaced via repo() being null */ }
      }
      // Nothing here invents `main`. The order is: what the URL asked for, then the branch this
      // repository is connected on, then whatever the provider lists first — and if none of those
      // exist the field stays empty and the engine reads the repository's own default branch.
      await this.repoMapService.loadBranches(id);
      const known = this.branches().map((b) => b.name);
      const repo = this.repo();
      const preferred = [qBranch, repo?.branch].find((b): b is string => Boolean(b));
      if (preferred && (known.length === 0 || known.includes(preferred))) {
        this.branchInput.set(preferred);
      } else {
        this.branchInput.set(known[0] ?? '');
      }

      if (this.clusterService.clusters().length === 0) {
        try { await this.clusterService.loadClusters(); } catch { /* cluster picker just stays empty */ }
      }

      await this.runMap();
    })();
  }

  async runMap(): Promise<void> {
    const id = this.repositoryId();
    if (!id) return;
    this.hasRun.set(true);
    const branch = this.branchInput().trim();
    const clusterId = this.clusterIdInput().trim();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { branch: branch || null, clusterId: clusterId || null },
      replaceUrl: true,
    });
    // A fresh read is a fresh question: the previous apply answered a map that is no longer the
    // one on screen, and leaving its card up would attach it to this one.
    this.repoMapService.clearApply();
    await this.repoMapService.loadMap(id, branch, clusterId);
    this.ranWith.set(this.result() ? { branch, clusterId } : null);
  }

  /** Cuts the Flui branch, commits the rendered manifests, starts the builds. Every unit the
   * render produced goes: narrowing the set is not offered here, and sending `unitIds` we did
   * not let anyone choose would be a choice made on their behalf. */
  async apply(): Promise<void> {
    if (this.applyDisabled()) return;
    const id = this.repositoryId();
    if (!id) return;
    await this.repoMapService.applyMap(
      id,
      this.clusterIdInput().trim(),
      this.branchInput().trim() || undefined,
    );
  }

  toggle(key: string): void {
    this.expandedKeys.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  readinessOf(verdict: VerdictDto, unitId: string): string {
    return verdict.units.find((u) => u.id === unitId)?.readiness ?? 'not_assessed';
  }

  readinessLabel(readiness: string): string {
    switch (readiness) {
      case 'deployable': return 'ready';
      case 'deployable_pending_inputs': return 'needs values';
      case 'blocked': return 'blocked';
      default: return 'not assessed';
    }
  }

  readinessClasses(readiness: string): string {
    switch (readiness) {
      case 'deployable': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'deployable_pending_inputs': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  }

  tagClasses(tag: string): string {
    return tag === 'needed to start'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }

  shortSha(sha: string): string {
    return sha.slice(0, 10);
  }

  /** The cluster half of the verdict, in one line and only when it was actually computed. */
  capacityLine(v: VerdictDto): string {
    const cap = v.capacity;
    if (!cap.assessed) {
      // `no-cluster-in-request` is the only silence that is right: nobody asked. The other two are
      // answers, and returning '' for them left a chosen cluster looking like it had been weighed.
      switch (cap.notAssessedReason) {
        case 'cluster-unreadable':
          return 'The chosen cluster could not be read, so nothing was weighed against it.';
        case 'no-declared-footprint':
          return 'Nothing here declares how much it needs, so it could not be weighed against the cluster.';
        default:
          return '';
      }
    }
    const a = cap.assessment;
    const head = a.fits ? 'Fits the cluster' : 'Does not fit the cluster';
    // A fit computed with parts left out is not a fit. The engine names what it could not weigh,
    // and counting those as zero is exactly how a `fits` that does not hold gets produced.
    const unweighed = cap.uncounted.length > 0
      ? ` ${cap.uncounted.length} thing${cap.uncounted.length === 1 ? '' : 's'} could not be weighed, so this may not hold.`
      : '';
    return `${head}: needs ${a.requiredCpuMillicores}m CPU and ${a.requiredMemoryMebibytes}Mi, ${a.availableCpuMillicores}m and ${a.availableMemoryMebibytes}Mi free.${unweighed}`;
  }

  /** The units counted by readiness — structured data, not the engine's concatenated prose. */
  verdictHeadline(v: VerdictDto): string {
    if (v.units.length === 0) return 'Nothing deployable was found on this branch.';
    const count = (readiness: string) => v.units.filter((u) => u.readiness === readiness).length;
    const ready = count('deployable');
    const pending = count('deployable_pending_inputs');
    const blocked = count('blocked');
    const unassessed = count('not_assessed');

    // The per-unit counts come from a different gate than the outcome: a map can refuse as a whole
    // (no unit renders a manifest, the cluster has no room) while every unit reads ready on its
    // own. Printing "1 app: 1 ready" under "Not deployable yet" answers the reader's one question
    // both ways at once, which is worse than answering it slowly.
    if (BAD_OUTCOMES.has(v.outcome) && blocked === 0 && unassessed === 0) {
      return firstSentence(v.reason);
    }

    const parts: string[] = [];
    if (ready > 0) parts.push(`${ready} ready`);
    if (pending > 0) parts.push(`${pending} needs values`);
    if (blocked > 0) parts.push(`${blocked} blocked`);
    if (unassessed > 0) parts.push(`${unassessed} not assessed`);
    return `${v.units.length} app${v.units.length === 1 ? '' : 's'}: ${parts.join(', ')}.`;
  }

  /** The engine names the root unit `.`, which on its own renders as a bare dot. */
  unitName(id: string): string {
    return id === '.' ? 'root' : id;
  }

  readonly firstSentence = firstSentence;
  readonly str = str;
}
