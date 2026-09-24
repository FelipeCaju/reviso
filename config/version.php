<?php

declare(strict_types=1);

/** Fonte única da versão exibida no aplicativo. */
const APP_VERSION = '1.4.3';
const APP_BUILD = '20260924.7';

function app_version_label(): string
{
    $label = 'Versão ' . APP_VERSION . ' · Build ' . APP_BUILD;
    $commit = getenv('APP_COMMIT_SHA');

    return $commit ? $label . ' · ' . substr($commit, 0, 7) : $label;
}
