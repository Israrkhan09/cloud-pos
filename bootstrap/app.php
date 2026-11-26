<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (\Illuminate\Console\Scheduling\Schedule $schedule) {
        $schedule->command('pos:sync')->everyMinute()->withoutOverlapping();
    })
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->validateCsrfTokens(except: [
            'backup/create',
            'backup/restore',
        ]);

        $middleware->encryptCookies(except: ['appearance']);

        $middleware->web(append: [
            \App\Http\Middleware\EnforceTenantContext::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\CheckPosPermission::class,
        ]);

        $middleware->alias([
            'pos.permission' => \App\Http\Middleware\CheckPosPermission::class,
            'tenant.enforce' => \App\Http\Middleware\EnforceTenantContext::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function (Request $request, Throwable $e) {
            if ($request->is('api/*')) {
                return true;
            }

            return $request->expectsJson();
        });

        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            if (!$request->is('api/*') && !$request->expectsJson() && in_array($response->getStatusCode(), [500, 503, 404, 403])) {
                return Inertia::render('error/index', [
                    'status' => $response->getStatusCode(),
                    'message' => $exception->getMessage()
                ])->toResponse($request)->setStatusCode($response->getStatusCode());
            }
            return $response;
        });
    })->create();

if ($customStorage = env('LARAVEL_STORAGE_PATH')) {
    $app->useStoragePath($customStorage);
}

return $app;
